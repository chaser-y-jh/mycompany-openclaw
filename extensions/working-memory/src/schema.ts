/**
 * SQL schema for the Working Memory extension.
 *
 * Working Memory is session-scoped: each session gets its own row.
 * Subtasks are stored as a JSON array (lean, no need for a separate table
 * since subtask volume per session is small — typically 3-15).
 *
 * Design decision: JSON column for subtasks rather than a normalized
 * subtask table because:
 *   1. Subtask count per session is bounded (< 50)
 *   2. Subtasks are always loaded/saved as a unit (never queried individually)
 *   3. Simplifies serialization/deserialization
 */

export const WORKING_MEMORY_SCHEMA_VERSION = 1;

export const WORKING_MEMORY_SCHEMA_SQL = `
-- Working memory: one row per agent session
CREATE TABLE IF NOT EXISTS working_memory (
  session_key   TEXT PRIMARY KEY NOT NULL,
  -- Current high-level goal the agent is pursuing
  goal          TEXT,
  -- JSON array of Subtask objects: [{id, description, status, parentId, result}, ...]
  subtasks_json TEXT DEFAULT '[]',
  -- Freetext scratchpad for intermediate calculations / notes
  scratchpad    TEXT DEFAULT '',
  -- JSON array of entity names the agent is currently focused on
  entities_json TEXT DEFAULT '[]',
  -- JSON array of pending Decision objects: [{id, question, options, selectedOption, timestamp}, ...]
  decisions_json TEXT DEFAULT '[]',
  -- Full snapshot for session resume after restart
  snapshot_json TEXT DEFAULT '{}',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Schema version tracking
CREATE TABLE IF NOT EXISTS wm_schema_meta (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT
);

INSERT OR IGNORE INTO wm_schema_meta (key, value)
VALUES ('schema_version', '${WORKING_MEMORY_SCHEMA_VERSION}');
`.trim();
