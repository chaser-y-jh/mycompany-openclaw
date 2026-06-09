/**
 * Type definitions for the Memory Router.
 *
 * The Memory Router provides a unified search interface across the
 * three memory sources in MerClaw:
 *   1. Vector Memory (LanceDB) — semantic/embedding-based search
 *   2. File Memory (MEMORY.md) — file-system based key-value memory
 *   3. Wiki Memory — structured knowledge base
 */

// ── Memory Sources ───────────────────────────────────────────────

/** The three memory backends available in MerClaw. */
export type MemorySource = "vector" | "file" | "wiki";

// ── Unified Memory Hit ───────────────────────────────────────────

/**
 * A single memory search result, normalized across all backends.
 * Each hit has a common shape regardless of which source produced it.
 */
export interface UnifiedMemoryHit {
  /** Which memory backend produced this hit */
  source: MemorySource;
  /** The content/snippet of the memory */
  content: string;
  /** Relevance score (0-1). For vector: cosine similarity. For file/wiki: TF-IDF or keyword match score. */
  relevance: number;
  /** Source-specific metadata */
  metadata: {
    /** File path (for file/wiki memory) */
    path?: string;
    /** Memory category (e.g. 'user', 'project', 'reference') */
    category?: string;
    /** When the memory was created/last modified */
    timestamp?: string;
    /** Memory slug/name */
    slug?: string;
    /** For vector: embedding distance. For file: match type (exact/partial/fuzzy) */
    matchType?: string;
  };
}

// ── Search Parameters ────────────────────────────────────────────

/** Parameters for a unified memory search. */
export interface MemorySearchParams {
  /** The search query (natural language) */
  query: string;
  /** Which memory sources to search (defaults to config.defaultSources) */
  sources?: MemorySource[];
  /** Maximum total results to return (default: 10) */
  maxResults?: number;
  /** Filter by memory category (e.g. only 'user' memories) */
  category?: string;
  /** Minimum relevance threshold (0-1, results below this are dropped) */
  minRelevance?: number;
}

// ── Search Result ────────────────────────────────────────────────

/** The full response from a memory search. */
export interface MemorySearchResult {
  /** Merged and ranked hits from all sources */
  hits: UnifiedMemoryHit[];
  /** Which sources were actually searched */
  searchedSources: MemorySource[];
  /** Which sources failed (and why) */
  errors: Array<{ source: MemorySource; error: string }>;
  /** Total search latency in ms */
  latencyMs: number;
}
