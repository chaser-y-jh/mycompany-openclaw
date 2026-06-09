/**
 * Intent Classifier — LLM Few-Shot classification + entity extraction.
 *
 * # Design Decisions
 *
 *   1. LLM Few-Shot (not rules): Chinese natural language is highly
 *      ambiguous. Rule-based classification would require constant
 *      maintenance. A small few-shot prompt (~500 tokens) gives high
 *      accuracy at negligible cost.
 *
 *   2. Single LLM call for intent + entities: We ask the LLM to return
 *      both in one JSON response. This halves latency compared to two
 *      sequential calls.
 *
 *   3. Classification runs BEFORE the main agent prompt is assembled.
 *      The result is injected into the prompt context so the agent's
 *      tool routing and decomposition can use it.
 *
 *   4. Fallback to "chat" on low confidence: If the classifier is
 *      uncertain (confidence < threshold), we fall back to treating
 *      the input as general chat. This prevents misclassification
 *      from cascading into wrong tool routing.
 */

import type {
  IntentResult,
  IntentType,
  ClassificationLLMResponse,
} from "./types.js";

// ── Few-Shot Classification Prompt ───────────────────────────────

/**
 * The few-shot prompt template for intent classification.
 *
 * Design notes:
 *   - Examples cover all 6 intent types with representative Chinese inputs
 *   - Each example includes entities to teach the LLM what to extract
 *   - The output format is strict JSON for reliable parsing
 *   - Subject field allows downstream routing (e.g., "math" → math tutor skill)
 */
const CLASSIFICATION_SYSTEM_PROMPT = `你是 MerClaw 的意图分类器。分析用户输入，输出 JSON。

## 意图类型
- qa:       问答/解题辅导（"这道题怎么做"）
- command:  操作指令/执行任务（"帮我备课"、"生成试卷"）
- query:    信息查询（"查看成绩"、"今天有什么作业"）
- creative: 内容创作（"写一篇作文"、"做个PPT"）
- chat:     闲聊/打招呼（"你好"、"今天天气不错"）
- emergency: 紧急情况（"着火了"、"有人受伤"）

## 实体类型
- subject:         学科（数学、英语、物理、化学、语文）
- grade:           年级（一年级、初二、高一、高三）
- knowledge_point: 知识点（二次函数、牛顿定律、定语从句）
- object:          对象（第5题、作业、试卷、课本）
- person:          人物（老师、小明、我自己）
- time:            时间（下周、明天下午、下节课）
- location:        地点（教室、操场、实验室）

## 示例
输入: "帮我解这道二次函数题"
输出: {"intent":"qa","subject":"math","confidence":0.95,"entities":[{"type":"knowledge_point","value":"二次函数","confidence":0.95},{"type":"subject","value":"数学","confidence":0.90}]}

输入: "帮我准备一份第三章的教案"
输出: {"intent":"command","subject":"teaching","confidence":0.92,"entities":[{"type":"object","value":"教案","confidence":0.90},{"type":"knowledge_point","value":"第三章","confidence":0.80}]}

输入: "查看我的数学成绩"
输出: {"intent":"query","subject":"grades","confidence":0.93,"entities":[{"type":"subject","value":"数学","confidence":0.90}]}

输入: "写一篇关于春天的作文"
输出: {"intent":"creative","subject":"writing","confidence":0.94,"entities":[{"type":"subject","value":"语文","confidence":0.85},{"type":"knowledge_point","value":"作文","confidence":0.90}]}

输入: "你好啊"
输出: {"intent":"chat","confidence":0.98,"entities":[]}

输入: "教室着火了快跑"
输出: {"intent":"emergency","confidence":0.99,"entities":[{"type":"location","value":"教室","confidence":0.90}]}

## 规则
1. 必须返回合法 JSON，不要有任何额外文字
2. confidence 必须在 0.0 到 1.0 之间
3. 如果无法确定意图，用 intent="chat" 和 confidence=0.5
4. 实体只提取明确提及的，不要猜测
5. subject 字段可选，用于标识学科或领域`;

// ── Input Preprocessing ──────────────────────────────────────────

/**
 * Lightweight sanitization before classification.
 * Strips excessive whitespace and trims to a reasonable length.
 */
function preprocessInput(input: string): string {
  return input
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000); // Truncate very long inputs — first 2000 chars is enough
}

// ── Response Parsing ─────────────────────────────────────────────

/**
 * Parse the LLM's JSON response into a typed IntentResult.
 * Includes defensive parsing for malformed LLM output.
 */
function parseClassificationResponse(
  raw: string,
  confidenceThreshold: number,
  latencyMs: number,
): IntentResult {
  // Try to extract JSON from the response (LLM may wrap in markdown code blocks)
  let json = raw.trim();

  // Strip markdown code fences if present
  const codeFenceMatch = json.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeFenceMatch) {
    json = codeFenceMatch[1].trim();
  }

  // Strip any leading/trailing non-JSON content
  const jsonMatch = json.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    json = jsonMatch[0];
  }

  let parsed: ClassificationLLMResponse;
  try {
    parsed = JSON.parse(json) as ClassificationLLMResponse;
  } catch {
    // If JSON parsing fails entirely, fall back to "chat"
    return {
      intent: "chat",
      confidence: 0.5,
      entities: [],
      latencyMs,
    };
  }

  // Validate intent type
  const validIntents: IntentType[] = [
    "qa", "command", "query", "creative", "chat", "emergency",
  ];
  const intent: IntentType = validIntents.includes(parsed.intent)
    ? parsed.intent
    : "chat";

  // Clamp confidence to [0, 1]
  const confidence = Math.max(0, Math.min(1, parsed.confidence ?? 0.5));

  // Apply confidence threshold
  if (confidence < confidenceThreshold) {
    return {
      intent: "chat",
      confidence,
      entities: [],
      latencyMs,
    };
  }

  // Validate entities
  const validEntityTypes = [
    "subject", "grade", "knowledge_point", "object", "person", "time", "location",
  ];
  const entities = (parsed.entities ?? [])
    .filter((e) => validEntityTypes.includes(e.type))
    .map((e) => ({
      type: e.type,
      value: String(e.value).slice(0, 200), // Truncate overly long values
      confidence: Math.max(0, Math.min(1, e.confidence ?? 0.7)),
    }));

  return {
    intent,
    subject: parsed.subject,
    confidence,
    entities,
    latencyMs,
  };
}

// ── Classification Function (called by the plugin) ───────────────

/**
 * Classify a user message using the configured LLM.
 *
 * @param userInput  - The raw user message text
 * @param callLLM    - Function to call the LLM (provided by the plugin, which
 *                     has access to the MerClaw LLM subsystem)
 * @param confidenceThreshold - Minimum confidence to trust the result
 * @returns IntentResult with classified intent and extracted entities
 */
export async function classifyIntent(
  userInput: string,
  callLLM: (systemPrompt: string, userMessage: string, maxTokens: number) => Promise<string>,
  confidenceThreshold: number = 0.6,
): Promise<IntentResult> {
  const startTime = Date.now();

  const cleanInput = preprocessInput(userInput);

  // Quick pre-check: very short greetings are almost certainly "chat"
  if (/^(你好|hi|hello|hey|在吗|嗨|哈喽)/i.test(cleanInput) && cleanInput.length < 20) {
    return {
      intent: "chat",
      confidence: 0.98,
      entities: [],
      latencyMs: 0, // Instant, no LLM call needed
    };
  }

  // Quick pre-check: explicit emergency keywords → short-circuit
  if (/着火了|救命|快跑|报警|地震了|有人受伤|110|120|119/.test(cleanInput)) {
    return {
      intent: "emergency",
      confidence: 0.99,
      entities: [],
      latencyMs: 0,
    };
  }

  try {
    const rawResponse = await callLLM(
      CLASSIFICATION_SYSTEM_PROMPT,
      `现在分类：\n"${cleanInput}"`,
      300, // max output tokens — classification JSON is small
    );

    const latencyMs = Date.now() - startTime;
    return parseClassificationResponse(rawResponse, confidenceThreshold, latencyMs);
  } catch (err) {
    // LLM call failed — fall back to "chat" so the agent can still respond
    return {
      intent: "chat",
      confidence: 0.5,
      entities: [],
      latencyMs: Date.now() - startTime,
    };
  }
}
