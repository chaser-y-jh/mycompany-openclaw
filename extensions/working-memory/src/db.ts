/**
 * Database access layer for Working Memory.
 *
 * Like education-auth, uses a plugin-dedicated SQLite database
 * stored under the MerClaw state directory. Each agent session
 * gets one row in the `working_memory` table.
 *
 * Why SQLite and not in-memory only:
 *   - Survives gateway restarts (session resume)
 *   - Allows cross-turn persistence without keeping JS objects alive
 *   - Cheap — one UPSERT per mutation, single-digit-ms latency
 */

import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { WORKING_MEMORY_SCHEMA_SQL } from "./schema.js";
import type {
  Subtask,
  Decision,
  WorkingMemoryRow,
  WorkingMemorySnapshot,
} from "./types.js";

// ── Singleton database handle ────────────────────────────────────

let _db: DatabaseSync | null = null;
let _dbDir: string | null = null;

/** Get (or lazily initialize) the working memory SQLite database. */
export function getWmDb(stateDir: string): DatabaseSync {
  const dir = join(stateDir, "working-memory");
  // Fast path: already open for this directory
  if (_db && _dbDir === dir) return _db;

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const dbPath = join(dir, "working-memory.sqlite");
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode=WAL;");
  db.exec(WORKING_MEMORY_SCHEMA_SQL);

  _db = db;
  _dbDir = dir;
  return db;
}

/** Close the database connection (called on plugin shutdown). */
export function closeWmDb(): void {
  if (_db) {
    _db.close();
    _db = null;
    _dbDir = null;
  }
}

// ── CRUD Operations ──────────────────────────────────────────────

/**
 * Load working memory for a session.
 * Returns a default-empty snapshot if no row exists yet.
 */
export function loadWorkingMemory(
  db: DatabaseSync,
  sessionKey: string,
): WorkingMemorySnapshot {
  const row = db
    .prepare("SELECT * FROM working_memory WHERE session_key = ?")
    .get(sessionKey) as WorkingMemoryRow | undefined;

  if (!row) {
    return {
      sessionKey,
      goal: null,
      subtasks: [],
      scratchpad: "",
      activeEntities: [],
      pendingDecisions: [],
    };
  }

  return rowToSnapshot(row);
}

/**
 * Upsert the full working memory state for a session.
 * Uses INSERT OR REPLACE so the caller doesn't need to know
 * whether the row already exists.
 */
export function saveWorkingMemory(
  db: DatabaseSync,
  snapshot: WorkingMemorySnapshot,
): void {
  db.prepare(`
    INSERT OR REPLACE INTO working_memory (
      session_key, goal, subtasks_json, scratchpad,
      entities_json, decisions_json, snapshot_json,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    snapshot.sessionKey,
    snapshot.goal,
    JSON.stringify(snapshot.subtasks),
    snapshot.scratchpad,
    JSON.stringify(snapshot.activeEntities),
    JSON.stringify(snapshot.pendingDecisions),
    JSON.stringify(snapshot),
  );
}

/**
 * Delete working memory for a session (called when session ends or is reset).
 */
export function deleteWorkingMemory(
  db: DatabaseSync,
  sessionKey: string,
): void {
  db.prepare("DELETE FROM working_memory WHERE session_key = ?").run(
    sessionKey,
  );
}

// ── Helpers ──────────────────────────────────────────────────────

/** Deserialize a database row into a typed snapshot. */
function rowToSnapshot(row: WorkingMemoryRow): WorkingMemorySnapshot {
  return {
    sessionKey: row.session_key,
    goal: row.goal,
    subtasks: safeJsonParse<Subtask[]>(row.subtasks_json, []),
    scratchpad: row.scratchpad ?? "",
    activeEntities: safeJsonParse<string[]>(row.entities_json, []),
    pendingDecisions: safeJsonParse<Decision[]>(row.decisions_json, []),
  };
}

/**
 * Parse JSON with a fallback default value.
 * Protects against corrupted data or manual edits.
 */
function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
