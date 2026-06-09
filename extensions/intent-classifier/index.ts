/**
 * Intent Classifier Extension — LLM few-shot intent + entity extraction.
 *
 * # Where It Fits
 *
 *   This extension sits at the very first stage of the LLM/Agent Layer
 *   pipeline, right after the message enters the system:
 *
 *     User Input → [Intent Classifier] → Task Decomposer → Memory Router → Agent
 *
 * # How It Works
 *
 *   1. On each `before_prompt_build` event, the user's latest message is
 *      sent to a small classification LLM call (few-shot prompt, ~500 tokens).
 *   2. The LLM returns JSON with intent type + entities + confidence.
 *   3. The result is injected into the agent's system prompt as an
 *      `<intent>` XML block, so downstream tools can use it.
 *   4. If intent is "emergency", a flag is set for the safety system.
 *
 * # Performance
 *
 *   Classification adds ~200-500ms latency (one small LLM call).
 *   For typical usage this is acceptable since the main agent inference
 *   takes much longer. The trade-off is worth it because:
 *     - Correct intent → better tool routing → fewer retries
 *     - Entity pre-extraction → richer context → more accurate responses
 */

import { definePluginEntry } from "merclaw/plugin-sdk/plugin-entry";
import type { MerClawPluginApi } from "merclaw/plugin-sdk/plugin-entry";
import { resolvePluginConfigObject } from "merclaw/plugin-sdk/plugin-config-runtime";
import type { MerClawConfig } from "merclaw/plugin-sdk/config-contracts";
import { classifyIntent } from "./src/classifier.js";
import type { IntentResult } from "./src/types.js";

// ── Plugin Config ────────────────────────────────────────────────

interface IntentClassifierConfig {
  enabled?: boolean;
  confidenceThreshold?: number;
  maxClassificationTokens?: number;
}

function resolveConfig(config?: MerClawConfig): IntentClassifierConfig {
  const pluginConfig = resolvePluginConfigObject(
    config,
    "intent-classifier",
  ) as IntentClassifierConfig | undefined;
  return pluginConfig ?? {};
}

// ── Intent Cache ─────────────────────────────────────────────────

/**
 * Per-session intent cache.
 *
 * Why cache: a single user message may trigger multiple hook firings
 * (before_prompt_build can fire for sub-agents, retries, etc.).
 * We cache the classification result per message to avoid redundant
 * LLM calls for the same input.
 *
 * Cache entries expire after 60 seconds (TTL) to prevent stale data
 * and unbounded memory growth.
 */
interface CacheEntry {
  result: IntentResult;
  timestamp: number;
}

const intentCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000; // 1 minute

/** Get cached classification or return null if expired/missing. */
function getCached(key: string): IntentResult | null {
  const entry = intentCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    intentCache.delete(key);
    return null;
  }
  return entry.result;
}

/** Store classification in cache. */
function setCached(key: string, result: IntentResult): void {
  intentCache.set(key, { result, timestamp: Date.now() });

  // Garbage collect: remove expired entries when cache grows
  if (intentCache.size > 100) {
    const now = Date.now();
    for (const [k, v] of intentCache) {
      if (now - v.timestamp > CACHE_TTL_MS) {
        intentCache.delete(k);
      }
    }
  }
}

// ── Plugin Entry ─────────────────────────────────────────────────

export default definePluginEntry({
  id: "intent-classifier",
  name: "Intent Classifier",
  description:
    "LLM few-shot intent classifier + entity extractor. Classifies user input into qa/command/query/creative/chat/emergency with extracted entities for tool routing.",

  register(api: MerClawPluginApi) {
    const cfg = resolveConfig(api.config);
    if (cfg.enabled === false) {
      api.logger.info?.("[intent-classifier] Disabled, skipping init");
      return;
    }

    const confidenceThreshold = cfg.confidenceThreshold ?? 0.6;
    const maxTokens = cfg.maxClassificationTokens ?? 300;

    // ── Hook: before_prompt_build ────────────────────────────

    /**
     * Intercept every agent prompt build to classify the intent
     * and inject the result as system context.
     *
     * We use before_prompt_build (not before_turn) because:
     *   1. The prompt is the point where we know what the user said
     *   2. We can inject context that the agent sees as system instructions
     *   3. It fires for every LLM call, including sub-agents
     */
    api.registerHook("before_prompt_build", async (event: unknown) => {
      const ev = event as {
        sessionKey?: string;
        userMessage?: string;
        messages?: Array<{ role: string; content: string }>;
        prependSystemContext?: string;
      };

      // Extract the latest user message
      const messages = ev.messages;
      if (!messages || messages.length === 0) return;

      const lastUserMsg = [...messages]
        .reverse()
        .find((m) => m.role === "user");
      if (!lastUserMsg?.content) return;

      const userInput = String(lastUserMsg.content);
      if (userInput.length < 2) return; // Skip empty/tiny inputs

      // Check cache first
      const cacheKey = `${ev.sessionKey ?? "global"}:${userInput.slice(0, 100)}`;
      let result = getCached(cacheKey);

      if (!result) {
        // Call LLM for classification
        result = await classifyIntent(
          userInput,
          async (systemPrompt, userMessage, tokens) => {
            // Use the agent's LLM subsystem for classification.
            // We construct a minimal completion call — the plugin SDK
            // provides access to the configured LLM provider.
            //
            // Note: this calls the same LLM the agent uses, but with a
            // small prompt (~500 tokens system + ~50 tokens user) and
            // low max_tokens (300). Cost is negligible per turn.
            try {
              // Attempt to use the LLM via the plugin API.
              // The exact API depends on the MerClaw version — we try
              // multiple approaches for compatibility.
              if (typeof (api as Record<string, unknown>).complete === "function") {
                const complete = (api as Record<string, Function>).complete;
                return String(await complete(systemPrompt, userMessage, { maxTokens: tokens }));
              }

              // Fallback: construct a simple fetch to the local LLM endpoint
              // if the plugin SDK doesn't expose complete() directly.
              // In practice, MerClaw's SDK exposes this via the LLM subsystem.
              if (typeof (api as Record<string, unknown>).llm?.complete === "function") {
                const llmComplete = (api as Record<string, { complete: Function }>).llm.complete;
                return String(await llmComplete(systemPrompt, userMessage, { maxTokens: tokens }));
              }

              // Last resort: skip classification and return default
              api.logger.warn?.(
                "[intent-classifier] No LLM completion API available — skipping classification",
              );
              return '{"intent":"chat","confidence":0.5,"entities":[]}';
            } catch (err) {
              api.logger.warn?.(
                `[intent-classifier] LLM call failed: ${(err as Error).message}`,
              );
              return '{"intent":"chat","confidence":0.5,"entities":[]}';
            }
          },
          confidenceThreshold,
        );

        setCached(cacheKey, result);
      }

      // ── Handle emergency intent ──────────────────────────

      if (result.intent === "emergency") {
        // Flag for safety system and inject high-priority context
        const emergencyBlock =
          "<emergency flag='true'>" +
          "用户消息被识别为紧急情况。请优先处理安全事项。" +
          "如果是真实紧急情况，建议用户拨打 119/120/110。" +
          "</emergency>";
        ev.prependSystemContext = emergencyBlock +
          (ev.prependSystemContext ? "\n" + ev.prependSystemContext : "");
        return;
      }

      // ── Inject classification context ────────────────────

      // Build a compact XML-like block for the agent to consume.
      // Keep it small (~100-300 tokens) to not waste context window.
      const entityLines = result.entities.length > 0
        ? result.entities
            .slice(0, 5) // Max 5 entities to avoid bloat
            .map((e) => `    <entity type="${e.type}" confidence="${e.confidence.toFixed(2)}">${e.value}</entity>`)
            .join("\n")
        : "";

      const classificationBlock = [
        "<intent>",
        `  <type confidence="${result.confidence.toFixed(2)}">${result.intent}</type>`,
        result.subject
          ? `  <subject>${result.subject}</subject>`
          : "",
        entityLines
          ? `  <entities>\n${entityLines}\n  </entities>`
          : "",
        "</intent>",
      ]
        .filter(Boolean)
        .join("\n");

      // Prepend to system context so the agent sees it as part of
      // its system instructions (not as user message)
      ev.prependSystemContext = classificationBlock +
        (ev.prependSystemContext ? "\n" + ev.prependSystemContext : "");
    });

    // ── Service Lifecycle ──────────────────────────────────

    api.registerService({
      id: "intent-classifier-service",
      start: async () => {
        api.logger.info?.(
          `[intent-classifier] Started — threshold: ${confidenceThreshold}, maxTokens: ${maxTokens}`,
        );
      },
      stop: async () => {
        intentCache.clear();
        api.logger.info?.("[intent-classifier] Stopped");
      },
    });

    api.logger.info?.("[intent-classifier] Intent Classifier plugin registered successfully");
  },
});
