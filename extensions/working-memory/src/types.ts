/**
 * Core type definitions for the Working Memory system.
 *
 * Working Memory sits between Short-Term (conversation context) and
 * Long-Term (vector/wiki/file memory). It tracks what the agent is
 * currently doing — the active task, its decomposition, intermediate
 * results, and pending decisions.
 */

// ── Subtask ──────────────────────────────────────────────────────

/** A single node in the task decomposition tree. */
export interface Subtask {
  /** Unique identifier within the session (e.g. 'subtask-1', 'subtask-2a') */
  id: string;
  /** Human-readable description of what this subtask accomplishes */
  description: string;
  /**
   * Execution status:
   * - pending: not yet ready (blocked by dependencies)
   * - ready: can be executed now
   * - in_progress: currently being worked on
   * - completed: finished successfully
   * - failed: finished with error
   */
  status: "pending" | "ready" | "in_progress" | "completed" | "failed";
  /** ID of the parent subtask, if this is a child (null for top-level) */
  parentId?: string;
  /** Output/result of the subtask after completion (free text) */
  result?: string;
  /** Recommended tools for this subtask (tool names) */
  assignedTools?: string[];
  /** How many times this subtask has been retried after failure */
  retries?: number;
  /** Maximum number of retries before giving up */
  maxRetries?: number;
}

// ── Decision ─────────────────────────────────────────────────────

/**
 * A decision the agent needs the user to make (or that the agent is
 * waiting for confirmation on before proceeding).
 */
export interface Decision {
  /** Unique decision ID */
  id: string;
  /** The question posed to the user */
  question: string;
  /** Available options */
  options: string[];
  /** The option selected by the user (null if pending) */
  selectedOption?: string;
  /** Timestamp when the decision was created */
  timestamp: number;
}

// ── Working Memory Snapshot ──────────────────────────────────────

/**
 * A serializable snapshot of the entire working memory state.
 * Used for session resume after restart and for tool responses.
 */
export interface WorkingMemorySnapshot {
  sessionKey: string;
  goal: string | null;
  subtasks: Subtask[];
  scratchpad: string;
  activeEntities: string[];
  pendingDecisions: Decision[];
}

// ── Working Memory Row (database shape) ──────────────────────────

/** Raw database row shape. */
export interface WorkingMemoryRow {
  session_key: string;
  goal: string | null;
  subtasks_json: string;
  scratchpad: string;
  entities_json: string;
  decisions_json: string;
  snapshot_json: string;
  created_at: string;
  updated_at: string;
}
