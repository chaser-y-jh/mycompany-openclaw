import { randomUUID } from "node:crypto";
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import {
  clearNodeSqliteKyselyCacheForDatabase,
  executeSqliteQuerySync,
  getNodeSqliteKysely,
} from "../infra/kysely-sync.js";
import { requireNodeSqlite } from "../infra/node-sqlite.js";
import { runSqliteImmediateTransactionSync } from "../infra/sqlite-transaction.js";
import { configureSqliteWalMaintenance, type SqliteWalMaintenance } from "../infra/sqlite-wal.js";
import type { DB as MerClawStateKyselyDatabase } from "./merclaw-state-db.generated.js";
import {
  resolveMerClawStateSqliteDir,
  resolveMerClawStateSqlitePath,
} from "./merclaw-state-db.paths.js";
import { MERCLAW_STATE_SCHEMA_SQL } from "./merclaw-state-schema.generated.js";

const MERCLAW_STATE_SCHEMA_VERSION = 1;
export const MERCLAW_SQLITE_BUSY_TIMEOUT_MS = 30_000;
const MERCLAW_STATE_DIR_MODE = 0o700;
const MERCLAW_STATE_FILE_MODE = 0o600;
const MERCLAW_STATE_SIDECAR_SUFFIXES = ["", "-shm", "-wal"] as const;

export type MerClawStateDatabase = {
  db: DatabaseSync;
  path: string;
  walMaintenance: SqliteWalMaintenance;
};

export type MerClawStateDatabaseOptions = {
  env?: NodeJS.ProcessEnv;
  path?: string;
};

export type MerClawMigrationRunStatus = "completed" | "warning" | "failed";
export type MerClawBackupRunStatus = "completed" | "failed";

export type RecordMerClawStateMigrationRunOptions = MerClawStateDatabaseOptions & {
  id?: string;
  startedAt: number;
  finishedAt?: number;
  status: MerClawMigrationRunStatus;
  report: Record<string, unknown>;
};

export type RecordMerClawStateMigrationSourceOptions = MerClawStateDatabaseOptions & {
  runId: string;
  migrationKind: string;
  sourceKey: string;
  sourcePath: string;
  targetTable: string;
  status: MerClawMigrationRunStatus;
  importedAt: number;
  removedSource: boolean;
  sourceSha256?: string;
  sourceSizeBytes?: number;
  sourceRecordCount?: number;
  report: Record<string, unknown>;
};

export type RecordMerClawStateBackupRunOptions = MerClawStateDatabaseOptions & {
  id?: string;
  createdAt: number;
  archivePath: string;
  status: MerClawBackupRunStatus;
  manifest: Record<string, unknown>;
};

const cachedDatabases = new Map<string, MerClawStateDatabase>();

type MerClawStateMetadataDatabase = Pick<
  MerClawStateKyselyDatabase,
  "backup_runs" | "migration_runs" | "migration_sources" | "schema_meta"
>;

function readSqliteUserVersion(db: DatabaseSync): number {
  const row = db.prepare("PRAGMA user_version").get() as { user_version?: unknown } | undefined;
  return Number(row?.user_version ?? 0);
}

function assertSupportedSchemaVersion(db: DatabaseSync, pathname: string): void {
  const userVersion = readSqliteUserVersion(db);
  if (userVersion > MERCLAW_STATE_SCHEMA_VERSION) {
    throw new Error(
      `MerClaw state database ${pathname} uses newer schema version ${userVersion}; this MerClaw build supports ${MERCLAW_STATE_SCHEMA_VERSION}.`,
    );
  }
}

function ensureMerClawStatePermissions(pathname: string, env: NodeJS.ProcessEnv): void {
  const dir = path.dirname(pathname);
  const defaultDir = resolveMerClawStateSqliteDir(env);
  const isDefaultStateDatabase =
    path.resolve(pathname) === path.resolve(resolveMerClawStateSqlitePath(env));
  if (isDefaultStateDatabase && dir !== defaultDir) {
    throw new Error(`MerClaw state database path resolved outside its state dir: ${pathname}`);
  }
  const dirExisted = existsSync(dir);
  mkdirSync(dir, { recursive: true, mode: MERCLAW_STATE_DIR_MODE });
  if (isDefaultStateDatabase || !dirExisted) {
    chmodSync(dir, MERCLAW_STATE_DIR_MODE);
  }
  for (const suffix of MERCLAW_STATE_SIDECAR_SUFFIXES) {
    const candidate = `${pathname}${suffix}`;
    if (existsSync(candidate)) {
      chmodSync(candidate, MERCLAW_STATE_FILE_MODE);
    }
  }
}

function tableHasColumn(db: DatabaseSync, tableName: string, columnName: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name?: unknown }>;
  return rows.some((row) => row.name === columnName);
}

function tableExists(db: DatabaseSync, tableName: string): boolean {
  const row = db
    .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName) as { ok?: unknown } | undefined;
  return row?.ok === 1;
}

function ensureColumn(db: DatabaseSync, tableName: string, columnSql: string): void {
  const columnName = columnSql.trim().split(/\s+/, 1)[0];
  if (!columnName || !tableExists(db, tableName) || tableHasColumn(db, tableName, columnName)) {
    return;
  }
  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnSql};`);
}

function backfillCronRunLogEntryJson(db: DatabaseSync): void {
  if (!tableExists(db, "cron_run_logs") || !tableHasColumn(db, "cron_run_logs", "entry_json")) {
    return;
  }
  const rows = db
    .prepare(
      `SELECT store_key, job_id, seq, ts
         FROM cron_run_logs
        WHERE entry_json = '{}'`,
    )
    .all() as Array<{
    store_key: string;
    job_id: string;
    seq: number | bigint;
    ts: number | bigint;
  }>;
  if (rows.length === 0) {
    return;
  }
  const update = db.prepare(
    `UPDATE cron_run_logs
        SET entry_json = ?
      WHERE store_key = ? AND job_id = ? AND seq = ?`,
  );
  for (const row of rows) {
    update.run(
      JSON.stringify({ ts: Number(row.ts), jobId: row.job_id, action: "finished" }),
      row.store_key,
      row.job_id,
      row.seq,
    );
  }
}

function ensureAdditiveStateColumns(db: DatabaseSync): void {
  ensureColumn(db, "node_pairing_pending", "client_id TEXT");
  ensureColumn(db, "node_pairing_pending", "client_mode TEXT");
  ensureColumn(db, "node_pairing_paired", "client_id TEXT");
  ensureColumn(db, "node_pairing_paired", "client_mode TEXT");
  ensureColumn(db, "cron_run_logs", "status TEXT");
  ensureColumn(db, "cron_run_logs", "error TEXT");
  ensureColumn(db, "cron_run_logs", "summary TEXT");
  ensureColumn(db, "cron_run_logs", "diagnostics_summary TEXT");
  ensureColumn(db, "cron_run_logs", "delivery_status TEXT");
  ensureColumn(db, "cron_run_logs", "delivery_error TEXT");
  ensureColumn(db, "cron_run_logs", "delivered INTEGER");
  ensureColumn(db, "cron_run_logs", "session_id TEXT");
  ensureColumn(db, "cron_run_logs", "session_key TEXT");
  ensureColumn(db, "cron_run_logs", "run_id TEXT");
  ensureColumn(db, "cron_run_logs", "run_at_ms INTEGER");
  ensureColumn(db, "cron_run_logs", "duration_ms INTEGER");
  ensureColumn(db, "cron_run_logs", "next_run_at_ms INTEGER");
  ensureColumn(db, "cron_run_logs", "model TEXT");
  ensureColumn(db, "cron_run_logs", "provider TEXT");
  ensureColumn(db, "cron_run_logs", "total_tokens INTEGER");
  ensureColumn(db, "cron_run_logs", "entry_json TEXT NOT NULL DEFAULT '{}'");
  ensureColumn(db, "cron_run_logs", "created_at INTEGER NOT NULL DEFAULT 0");
  backfillCronRunLogEntryJson(db);
  ensureColumn(db, "cron_jobs", "description TEXT");
  ensureColumn(db, "cron_jobs", "delete_after_run INTEGER");
  ensureColumn(db, "cron_jobs", "agent_id TEXT");
  ensureColumn(db, "cron_jobs", "session_key TEXT");
  ensureColumn(db, "cron_jobs", "schedule_expr TEXT");
  ensureColumn(db, "cron_jobs", "schedule_tz TEXT");
  ensureColumn(db, "cron_jobs", "every_ms INTEGER");
  ensureColumn(db, "cron_jobs", "anchor_ms INTEGER");
  ensureColumn(db, "cron_jobs", "at TEXT");
  ensureColumn(db, "cron_jobs", "stagger_ms INTEGER");
  ensureColumn(db, "cron_jobs", "payload_message TEXT");
  ensureColumn(db, "cron_jobs", "payload_model TEXT");
  ensureColumn(db, "cron_jobs", "payload_fallbacks_json TEXT");
  ensureColumn(db, "cron_jobs", "payload_thinking TEXT");
  ensureColumn(db, "cron_jobs", "payload_timeout_seconds INTEGER");
  ensureColumn(db, "cron_jobs", "payload_allow_unsafe_external_content INTEGER");
  ensureColumn(db, "cron_jobs", "payload_external_content_source_json TEXT");
  ensureColumn(db, "cron_jobs", "payload_light_context INTEGER");
  ensureColumn(db, "cron_jobs", "payload_tools_allow_json TEXT");
  ensureColumn(db, "cron_jobs", "delivery_mode TEXT");
  ensureColumn(db, "cron_jobs", "delivery_channel TEXT");
  ensureColumn(db, "cron_jobs", "delivery_to TEXT");
  ensureColumn(db, "cron_jobs", "delivery_thread_id TEXT");
  ensureColumn(db, "cron_jobs", "delivery_account_id TEXT");
  ensureColumn(db, "cron_jobs", "delivery_best_effort INTEGER");
  ensureColumn(db, "cron_jobs", "delivery_completion_mode TEXT");
  ensureColumn(db, "cron_jobs", "delivery_completion_to TEXT");
  ensureColumn(db, "cron_jobs", "failure_delivery_mode TEXT");
  ensureColumn(db, "cron_jobs", "failure_delivery_channel TEXT");
  ensureColumn(db, "cron_jobs", "failure_delivery_to TEXT");
  ensureColumn(db, "cron_jobs", "failure_delivery_account_id TEXT");
  ensureColumn(db, "cron_jobs", "failure_alert_disabled INTEGER");
  ensureColumn(db, "cron_jobs", "failure_alert_after INTEGER");
  ensureColumn(db, "cron_jobs", "failure_alert_channel TEXT");
  ensureColumn(db, "cron_jobs", "failure_alert_to TEXT");
  ensureColumn(db, "cron_jobs", "failure_alert_cooldown_ms INTEGER");
  ensureColumn(db, "cron_jobs", "failure_alert_include_skipped INTEGER");
  ensureColumn(db, "cron_jobs", "failure_alert_mode TEXT");
  ensureColumn(db, "cron_jobs", "failure_alert_account_id TEXT");
  ensureColumn(db, "cron_jobs", "next_run_at_ms INTEGER");
  ensureColumn(db, "cron_jobs", "running_at_ms INTEGER");
  ensureColumn(db, "cron_jobs", "last_run_at_ms INTEGER");
  ensureColumn(db, "cron_jobs", "last_run_status TEXT");
  ensureColumn(db, "cron_jobs", "last_error TEXT");
  ensureColumn(db, "cron_jobs", "last_duration_ms INTEGER");
  ensureColumn(db, "cron_jobs", "consecutive_errors INTEGER");
  ensureColumn(db, "cron_jobs", "consecutive_skipped INTEGER");
  ensureColumn(db, "cron_jobs", "schedule_error_count INTEGER");
  ensureColumn(db, "cron_jobs", "last_delivery_status TEXT");
  ensureColumn(db, "cron_jobs", "last_delivery_error TEXT");
  ensureColumn(db, "cron_jobs", "last_delivered INTEGER");
  ensureColumn(db, "cron_jobs", "last_failure_alert_at_ms INTEGER");
  ensureColumn(db, "cron_jobs", "state_json TEXT NOT NULL DEFAULT '{}'");
  ensureColumn(db, "cron_jobs", "runtime_updated_at_ms INTEGER");
  ensureColumn(db, "cron_jobs", "schedule_identity TEXT");
  ensureColumn(db, "cron_jobs", "sort_order INTEGER NOT NULL DEFAULT 0");
}

function ensureSchema(db: DatabaseSync, pathname: string): void {
  assertSupportedSchemaVersion(db, pathname);
  ensureAdditiveStateColumns(db);
  db.exec(MERCLAW_STATE_SCHEMA_SQL);
  ensureAdditiveStateColumns(db);
  db.exec(`PRAGMA user_version = ${MERCLAW_STATE_SCHEMA_VERSION};`);
  const now = Date.now();
  const kysely = getNodeSqliteKysely<MerClawStateMetadataDatabase>(db);
  executeSqliteQuerySync(
    db,
    kysely
      .insertInto("schema_meta")
      .values({
        meta_key: "primary",
        role: "global",
        schema_version: MERCLAW_STATE_SCHEMA_VERSION,
        agent_id: null,
        app_version: null,
        created_at: now,
        updated_at: now,
      })
      .onConflict((conflict) =>
        conflict.column("meta_key").doUpdateSet({
          role: "global",
          schema_version: MERCLAW_STATE_SCHEMA_VERSION,
          agent_id: null,
          app_version: null,
          updated_at: now,
        }),
      ),
  );
}

function resolveDatabasePath(options: MerClawStateDatabaseOptions = {}): string {
  return options.path ?? resolveMerClawStateSqlitePath(options.env ?? process.env);
}

export function openMerClawStateDatabase(
  options: MerClawStateDatabaseOptions = {},
): MerClawStateDatabase {
  const env = options.env ?? process.env;
  const pathname = resolveDatabasePath(options);
  const cached = cachedDatabases.get(pathname);
  if (cached?.db.isOpen) {
    return cached;
  }
  if (cached) {
    cached.walMaintenance.close();
    clearNodeSqliteKyselyCacheForDatabase(cached.db);
    cachedDatabases.delete(pathname);
  }

  ensureMerClawStatePermissions(pathname, env);
  const sqlite = requireNodeSqlite();
  const db = new sqlite.DatabaseSync(pathname);
  const walMaintenance = configureSqliteWalMaintenance(db, {
    databaseLabel: "merclaw-state",
    databasePath: pathname,
  });
  db.exec("PRAGMA synchronous = NORMAL;");
  db.exec(`PRAGMA busy_timeout = ${MERCLAW_SQLITE_BUSY_TIMEOUT_MS};`);
  db.exec("PRAGMA foreign_keys = ON;");
  try {
    ensureSchema(db, pathname);
  } catch (err) {
    walMaintenance.close();
    db.close();
    throw err;
  }
  ensureMerClawStatePermissions(pathname, env);
  const database = { db, path: pathname, walMaintenance };
  cachedDatabases.set(pathname, database);
  return database;
}

export function runMerClawStateWriteTransaction<T>(
  operation: (database: MerClawStateDatabase) => T,
  options: MerClawStateDatabaseOptions = {},
): T {
  const database = openMerClawStateDatabase(options);
  const result = runSqliteImmediateTransactionSync(database.db, () => operation(database));
  try {
    ensureMerClawStatePermissions(database.path, options.env ?? process.env);
  } catch {
    // The write already committed; permission hardening is best-effort here so
    // callers never retry an operation that is durable in SQLite.
  }
  return result;
}

export function recordMerClawStateMigrationRun(
  options: RecordMerClawStateMigrationRunOptions,
): string {
  const id = options.id ?? randomUUID();
  runMerClawStateWriteTransaction((database) => {
    const db = getNodeSqliteKysely<MerClawStateMetadataDatabase>(database.db);
    executeSqliteQuerySync(
      database.db,
      db.insertInto("migration_runs").values({
        id,
        started_at: options.startedAt,
        finished_at: options.finishedAt ?? null,
        status: options.status,
        report_json: JSON.stringify(options.report),
      }),
    );
  }, options);
  return id;
}

export function recordMerClawStateMigrationSource(
  options: RecordMerClawStateMigrationSourceOptions,
): void {
  runMerClawStateWriteTransaction((database) => {
    const db = getNodeSqliteKysely<MerClawStateMetadataDatabase>(database.db);
    executeSqliteQuerySync(
      database.db,
      db
        .insertInto("migration_sources")
        .values({
          source_key: options.sourceKey,
          migration_kind: options.migrationKind,
          source_path: options.sourcePath,
          target_table: options.targetTable,
          source_sha256: options.sourceSha256 ?? null,
          source_size_bytes: options.sourceSizeBytes ?? null,
          source_record_count: options.sourceRecordCount ?? null,
          last_run_id: options.runId,
          status: options.status,
          imported_at: options.importedAt,
          removed_source: options.removedSource ? 1 : 0,
          report_json: JSON.stringify(options.report),
        })
        .onConflict((conflict) =>
          conflict.column("source_key").doUpdateSet({
            migration_kind: (eb) => eb.ref("excluded.migration_kind"),
            source_path: (eb) => eb.ref("excluded.source_path"),
            target_table: (eb) => eb.ref("excluded.target_table"),
            source_sha256: (eb) => eb.ref("excluded.source_sha256"),
            source_size_bytes: (eb) => eb.ref("excluded.source_size_bytes"),
            source_record_count: (eb) => eb.ref("excluded.source_record_count"),
            last_run_id: (eb) => eb.ref("excluded.last_run_id"),
            status: (eb) => eb.ref("excluded.status"),
            imported_at: (eb) => eb.ref("excluded.imported_at"),
            removed_source: (eb) => eb.ref("excluded.removed_source"),
            report_json: (eb) => eb.ref("excluded.report_json"),
          }),
        ),
    );
  }, options);
}

export function recordMerClawStateBackupRun(options: RecordMerClawStateBackupRunOptions): string {
  const id = options.id ?? randomUUID();
  runMerClawStateWriteTransaction((database) => {
    const db = getNodeSqliteKysely<MerClawStateMetadataDatabase>(database.db);
    executeSqliteQuerySync(
      database.db,
      db.insertInto("backup_runs").values({
        id,
        created_at: options.createdAt,
        archive_path: options.archivePath,
        status: options.status,
        manifest_json: JSON.stringify(options.manifest),
      }),
    );
  }, options);
  return id;
}

export function closeMerClawStateDatabase(): void {
  for (const database of cachedDatabases.values()) {
    database.walMaintenance.close();
    clearNodeSqliteKyselyCacheForDatabase(database.db);
    if (database.db.isOpen) {
      database.db.close();
    }
  }
  cachedDatabases.clear();
}

export function isMerClawStateDatabaseOpen(): boolean {
  return Array.from(cachedDatabases.values()).some((database) => database.db.isOpen);
}

export const closeMerClawStateDatabaseForTest = closeMerClawStateDatabase;
