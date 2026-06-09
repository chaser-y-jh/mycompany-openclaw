/**
 * Memory Router Extension — Unified search across all memory backends.
 *
 * # Problem This Solves
 *
 *   MerClaw has three separate memory systems:
 *     - memory-lancedb  → `memory_recall` tool (vector/semantic search)
 *     - memory-core     → `memory_search` tool (file/MEMORY.md search)
 *     - memory-wiki     → `wiki_search` tool (knowledge base search)
 *
 *   The agent has to know WHICH tool to call for WHICH type of query.
 *   This is friction — the agent shouldn't need to understand the
 *   storage backend to find relevant memories.
 *
 * # Solution
 *
 *   `memory_router_search` — a single tool that:
 *     1. Fans out the query to all enabled memory sources in parallel
 *     2. Normalizes results into a common format (UnifiedMemoryHit)
 *     3. Merges, deduplicates, and re-ranks by relevance
 *     4. Returns the top-N results with source attribution
 *
 * # When To Use Each Directly
 *
 *   The router is the default. Use source-specific tools when:
 *     - You need raw vector distances (use memory_recall directly)
 *     - You need to write/update memory (use memory_store / wiki_apply)
 *     - You need to delete (use memory_forget)
 */

import { definePluginEntry } from "merclaw/plugin-sdk/plugin-entry";
import type { MerClawPluginApi } from "merclaw/plugin-sdk/plugin-entry";
import { resolvePluginConfigObject } from "merclaw/plugin-sdk/plugin-config-runtime";
import type { MerClawConfig } from "merclaw/plugin-sdk/config-contracts";
import type {
  MemorySource,
  UnifiedMemoryHit,
  MemorySearchParams,
  MemorySearchResult,
} from "./src/types.js";

// ── Plugin Config ────────────────────────────────────────────────

interface MemoryRouterConfig {
  enabled?: boolean;
  defaultSources?: MemorySource[];
  maxTotalResults?: number;
  deduplicateThreshold?: number;
}

function resolveConfig(config?: MerClawConfig): MemoryRouterConfig {
  const pluginConfig = resolvePluginConfigObject(
    config,
    "memory-router",
  ) as MemoryRouterConfig | undefined;
  return pluginConfig ?? {};
}

// ── Deduplication ────────────────────────────────────────────────

/**
 * Simple content-based deduplication.
 *
 * Two hits are considered duplicates if their content similarity
 * exceeds the deduplicate threshold. We use a Jaccard-like word
 * overlap metric (fast, no embedding needed).
 *
 * When duplicates are found, we keep the hit with the highest
 * relevance score and drop the other(s).
 */
function deduplicateHits(
  hits: UnifiedMemoryHit[],
  threshold: number,
): UnifiedMemoryHit[] {
  const result: UnifiedMemoryHit[] = [];

  for (const hit of hits) {
    const isDup = result.some((existing) => {
      const similarity = wordOverlapSimilarity(existing.content, hit.content);
      return similarity >= threshold;
    });

    if (!isDup) {
      result.push(hit);
    }
    // If it IS a dup, we already have a version (the existing one came first
    // and hits were pre-sorted by relevance, so the existing one is better).
  }

  return result;
}

/**
 * Jaccard-like word overlap between two strings.
 * Returns a value between 0 (no overlap) and 1 (identical word sets).
 */
function wordOverlapSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 1));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 1));

  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }

  const union = wordsA.size + wordsB.size - intersection;
  return intersection / union;
}

// ── Plugin Entry ─────────────────────────────────────────────────

export default definePluginEntry({
  id: "memory-router",
  name: "Memory Router",
  description:
    "Unified memory search across vector (LanceDB), file (MEMORY.md), and wiki memory sources.",

  register(api: MerClawPluginApi) {
    const cfg = resolveConfig(api.config);
    if (cfg.enabled === false) {
      api.logger.info?.("[memory-router] Disabled, skipping init");
      return;
    }

    const defaultSources: MemorySource[] = cfg.defaultSources ?? ["vector", "file"];
    const maxTotalResults = cfg.maxTotalResults ?? 10;
    const deduplicateThreshold = cfg.deduplicateThreshold ?? 0.85;

    // ── Tool: memory_router_search ───────────────────────────

    /**
     * The unified memory search tool.
     *
     * This tool fans out to all enabled memory sources, collects results,
     * merges and deduplicates them, and returns the top hits.
     *
     * The agent should prefer this over source-specific search tools
     * unless it has a specific reason to target one backend.
     */
    api.registerTool({
      name: "memory_router_search",
      description:
        "Search ALL memory sources (vector/LanceDB, file/MEMORY.md, wiki) " +
        "in one call. Returns merged and deduplicated results ranked by relevance. " +
        "Use this as the default memory search — it's smarter than calling " +
        "memory_recall / memory_search / wiki_search individually.\n" +
        "Each result includes its source, content, relevance score, and metadata.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query in natural language. Be specific — " +
              "good queries produce better results. E.g. 'user preference for dark mode' " +
              "not just 'settings'.",
          },
          sources: {
            type: "array",
            items: { type: "string", enum: ["vector", "file", "wiki"] },
            description: "Which memory sources to search. Defaults to vector + file. " +
              "Use ['file'] for exact keyword searches, ['vector'] for semantic similarity.",
          },
          max_results: {
            type: "number",
            description: "Max total results (default: 10). Higher values may return more noise.",
          },
          category: {
            type: "string",
            description: "Filter by memory category (only works for file/wiki sources).",
          },
          min_relevance: {
            type: "number",
            description: "Minimum relevance threshold (0-1). Lower = more results but more noise.",
          },
        },
        required: ["query"],
      },
      async execute(_toolCallId, params: unknown) {
        const p = params as MemorySearchParams;
        const startTime = Date.now();

        const sources = p.sources ?? defaultSources;
        const maxResults = p.maxResults ?? maxTotalResults;
        const minRelevance = p.minRelevance ?? 0.3;

        // ── Fan-out to memory sources ──────────────────────

        // We try each source independently. If a source fails (e.g.
        // LanceDB not configured), we log the error and continue
        // with the remaining sources. Partial results are better
        // than no results.

        const allHits: UnifiedMemoryHit[] = [];
        const errors: Array<{ source: MemorySource; error: string }> = [];

        /**
         * Each source search is wrapped in a try-catch so that one
         * failing source doesn't block the others. Results are
         * collected into the allHits array.
         *
         * We use the existing tool infrastructure to call the
         * source-specific memory tools. The plugin SDK provides
         * access to registered tools via the tool registry.
         */

        // Helper: invoke a registered tool by name
        async function trySearchSource(
          source: MemorySource,
          toolName: string,
          toolParams: Record<string, unknown>,
        ): Promise<void> {
          try {
            // Use the plugin API to invoke another registered tool.
            // The tool invocation goes through the standard tool execution
            // pipeline, which means hooks (like RBAC) still apply.
            if (typeof (api as Record<string, unknown>).invokeTool === "function") {
              const invokeTool = (api as Record<string, Function>).invokeTool;
              const result = await invokeTool(toolName, toolParams);

              if (result && typeof result === "object") {
                const hits = extractHits(source, result as Record<string, unknown>);
                allHits.push(...hits);
              }
            } else {
              // If invokeTool is not available, we gracefully degrade
              // and return an empty result. The agent can still use
              // source-specific tools directly.
              api.logger.warn?.(
                `[memory-router] invokeTool API not available — skipping ${source} search`,
              );
            }
          } catch (err) {
            errors.push({
              source,
              error: `Search failed: ${(err as Error).message}`,
            });
          }
        }

        // Fan out to all requested sources in parallel
        const searchPromises: Promise<void>[] = [];

        if (sources.includes("vector")) {
          searchPromises.push(
            trySearchSource("vector", "memory_recall", {
              query: p.query,
              limit: maxResults * 2, // Over-fetch for better merge quality
            }),
          );
        }

        if (sources.includes("file")) {
          searchPromises.push(
            trySearchSource("file", "memory_search", {
              query: p.query,
              max_results: maxResults * 2,
            }),
          );
        }

        if (sources.includes("wiki")) {
          searchPromises.push(
            trySearchSource("wiki", "wiki_search", {
              query: p.query,
              max_results: maxResults * 2,
            }),
          );
        }

        // Wait for all sources to complete (or fail)
        await Promise.allSettled(searchPromises);

        // ── Post-processing ────────────────────────────────

        // 1. Apply minimum relevance filter
        const filtered = allHits.filter((h) => h.relevance >= minRelevance);

        // 2. Sort by relevance descending
        filtered.sort((a, b) => b.relevance - a.relevance);

        // 3. Deduplicate
        const deduped = deduplicateHits(filtered, deduplicateThreshold);

        // 4. Truncate to max results
        const final = deduped.slice(0, maxResults);

        const latencyMs = Date.now() - startTime;

        return {
          query: p.query,
          hits: final,
          searched_sources: sources,
          source_errors: errors.length > 0 ? errors : undefined,
          latency_ms: latencyMs,
          result_count: final.length,
          hint:
            final.length === 0
              ? "No relevant memories found. Try broadening your query or adding more sources."
              : undefined,
        } satisfies MemorySearchResult & {
          query: string;
          hint?: string;
          result_count: number;
        };
      },
    });

    // ── Service Lifecycle ──────────────────────────────────

    api.registerService({
      id: "memory-router-service",
      start: async () => {
        api.logger.info?.(
          `[memory-router] Started — sources: ${defaultSources.join(", ")}, maxResults: ${maxTotalResults}`,
        );
      },
      stop: async () => {
        api.logger.info?.("[memory-router] Stopped");
      },
    });

    api.logger.info?.("[memory-router] Memory Router plugin registered successfully");
  },
});

// ── Hit Extraction Helpers ───────────────────────────────────────

/**
 * Extract UnifiedMemoryHit objects from a source-specific tool response.
 *
 * Each memory source tool returns a slightly different shape.
 * These extractors normalize them into the common UnifiedMemoryHit format.
 */
function extractHits(
  source: MemorySource,
  result: Record<string, unknown>,
): UnifiedMemoryHit[] {
  switch (source) {
    case "vector": {
      // memory_recall returns { results: [{ content, distance, metadata }, ...] }
      const results = result.results as Array<Record<string, unknown>> | undefined;
      if (!results?.length) return [];
      return results.map((r) => ({
        source: "vector" as const,
        content: String(r.content ?? ""),
        relevance: 1 - (Number(r.distance) ?? 0), // Convert distance to relevance
        metadata: {
          timestamp: String(r.metadata?.timestamp ?? ""),
          matchType: "semantic",
          category: String(r.metadata?.category ?? ""),
        },
      }));
    }

    case "file": {
      // memory_search returns { matches: [{ content, score, path }, ...] }
      const matches = result.matches as Array<Record<string, unknown>> | undefined;
      if (!matches?.length) return [];
      return matches.map((m) => ({
        source: "file" as const,
        content: String(m.content ?? ""),
        relevance: Math.min(1, (Number(m.score) ?? 0) / 10), // Normalize score to 0-1
        metadata: {
          path: String(m.path ?? ""),
          matchType: String(m.matchType ?? "keyword"),
          category: String(m.category ?? ""),
        },
      }));
    }

    case "wiki": {
      // wiki_search returns { pages: [{ title, content, score }, ...] }
      const pages = result.pages as Array<Record<string, unknown>> | undefined;
      if (!pages?.length) return [];
      return pages.map((p) => ({
        source: "wiki" as const,
        content: String(p.content ?? ""),
        relevance: Math.min(1, (Number(p.score) ?? 0) / 10),
        metadata: {
          slug: String(p.title ?? ""),
          matchType: "keyword",
          category: "wiki",
        },
      }));
    }

    default:
      return [];
  }
}
