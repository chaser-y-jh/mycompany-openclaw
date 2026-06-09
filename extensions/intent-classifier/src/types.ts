/**
 * Type definitions for the Intent Classifier.
 *
 * The classifier uses a single LLM call to both classify the intent
 * and extract entities, avoiding extra latency from sequential calls.
 */

// ── Intent Types ─────────────────────────────────────────────────

/**
 * The six intent categories the classifier recognizes.
 *
 * - qa:        Question answering — "解这道函数题", "牛顿定律是什么"
 * - command:   Action/instruction — "帮我备课第二章", "打开灯"
 * - query:     Information lookup — "今天有哪些作业", "查看我的成绩"
 * - creative:  Content generation — "写一篇作文", "画个思维导图"
 * - chat:      Casual conversation — "你好", "今天天气真好"
 * - emergency: Urgent/safety — "着火了", "有人受伤了"
 */
export type IntentType =
  | "qa"
  | "command"
  | "query"
  | "creative"
  | "chat"
  | "emergency";

// ── Entity Types ─────────────────────────────────────────────────

/**
 * Entities extracted from the user input.
 * Each entity has a type, value, and confidence score.
 */
export interface Entity {
  /**
   * Entity type:
   * - subject:          Academic subject (数学, 英语, 物理...)
   * - grade:            Grade level (三年级, 高一...)
   * - knowledge_point:  Specific knowledge point (二次函数, 牛顿第二定律...)
   * - object:           Tangible thing referenced (第5题, 作业本...)
   * - person:           Person referenced (李老师, 小明...)
   * - time:             Time reference (下周, 明天下午...)
   * - location:         Place reference (教室, 操场...)
   */
  type: "subject" | "grade" | "knowledge_point" | "object" | "person" | "time" | "location";
  /** The extracted value string */
  value: string;
  /** Confidence score 0-1 */
  confidence: number;
}

// ── Classification Result ────────────────────────────────────────

/** The full result of intent classification + entity extraction. */
export interface IntentResult {
  /** The classified intent type */
  intent: IntentType;
  /** Optional subject/domain for more specific routing */
  subject?: string;
  /** Confidence score for the primary intent (0-1) */
  confidence: number;
  /** Extracted entities */
  entities: Entity[];
  /** Raw classification latency in ms (for monitoring) */
  latencyMs?: number;
}

// ── LLM Response Format ──────────────────────────────────────────

/**
 * The shape of the JSON response we expect from the LLM
 * when called for classification.
 */
export interface ClassificationLLMResponse {
  intent: IntentType;
  subject?: string;
  confidence: number;
  entities: Array<{
    type: Entity["type"];
    value: string;
    confidence: number;
  }>;
}
