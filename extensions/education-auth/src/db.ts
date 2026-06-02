/**
 * Database access layer for education auth.
 *
 * Uses the education-specific SQLite database file managed by the plugin.
 * The database path is resolved from the OpenClaw state directory.
 */

import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import type { EduRole } from "./roles.js";
import { EDU_AUTH_SCHEMA_SQL } from "./schema.js";

export interface EduUser {
  user_id: string;
  school_id: string;
  role: EduRole;
  display_name: string;
  grade_level: string | null;
  class_id: string | null;
  parent_of_user_id: string | null;
  channel_id: string | null;
  auth_identifier: string | null;
  avatar_url: string | null;
  is_active: number;
  metadata_json: string;
  created_at: string;
  updated_at: string;
}

export interface EduClass {
  class_id: string;
  school_id: string;
  name: string;
  grade_level: string;
  teacher_user_id: string | null;
  subject: string | null;
  is_active: number;
  metadata_json: string;
  created_at: string;
  updated_at: string;
}

export interface EduEnrollment {
  enrollment_id: string;
  user_id: string;
  class_id: string;
  enrolled_at: string;
}

export interface EduSchool {
  school_id: string;
  name: string;
  config_json: string;
  created_at: string;
  updated_at: string;
}

let _db: DatabaseSync | null = null;
let _dbDir: string | null = null;

/** Get (or initialize) the education database. */
export function getEduDb(stateDir: string): DatabaseSync {
  const dir = join(stateDir, "education");
  if (_db && _dbDir === dir) return _db;

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const dbPath = join(dir, "education.sqlite");
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode=WAL;");
  db.exec("PRAGMA foreign_keys=ON;");

  // Run schema migration
  db.exec(EDU_AUTH_SCHEMA_SQL);

  _db = db;
  _dbDir = dir;
  return db;
}

/** Close the database connection. */
export function closeEduDb(): void {
  if (_db) {
    _db.close();
    _db = null;
    _dbDir = null;
  }
}

// ── User Queries ──────────────────────────────────────────────

export function insertUser(
  db: DatabaseSync,
  user: Omit<EduUser, "created_at" | "updated_at">,
): void {
  const stmt = db.prepare(`
    INSERT INTO edu_users (
      user_id, school_id, role, display_name, grade_level, class_id,
      parent_of_user_id, channel_id, auth_identifier, avatar_url,
      is_active, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    user.user_id,
    user.school_id,
    user.role,
    user.display_name,
    user.grade_level ?? null,
    user.class_id ?? null,
    user.parent_of_user_id ?? null,
    user.channel_id ?? null,
    user.auth_identifier ?? null,
    user.avatar_url ?? null,
    user.is_active,
    user.metadata_json,
  );
}

export function findUserById(
  db: DatabaseSync,
  userId: string,
): EduUser | undefined {
  return db
    .prepare("SELECT * FROM edu_users WHERE user_id = ?")
    .get(userId) as EduUser | undefined;
}

export function findUserByChannel(
  db: DatabaseSync,
  schoolId: string,
  channelId: string,
): EduUser | undefined {
  return db
    .prepare(
      "SELECT * FROM edu_users WHERE school_id = ? AND channel_id = ? AND is_active = 1",
    )
    .get(schoolId, channelId) as EduUser | undefined;
}

export function findUserByAuthIdentifier(
  db: DatabaseSync,
  authIdentifier: string,
): EduUser | undefined {
  return db
    .prepare(
      "SELECT * FROM edu_users WHERE auth_identifier = ? AND is_active = 1",
    )
    .get(authIdentifier) as EduUser | undefined;
}

export function listUsersByRole(
  db: DatabaseSync,
  schoolId: string,
  role: EduRole,
): EduUser[] {
  return db
    .prepare(
      "SELECT * FROM edu_users WHERE school_id = ? AND role = ? AND is_active = 1 ORDER BY display_name",
    )
    .all(schoolId, role) as EduUser[];
}

export function listUsersByClass(
  db: DatabaseSync,
  classId: string,
): EduUser[] {
  return db
    .prepare(
      "SELECT * FROM edu_users WHERE class_id = ? AND is_active = 1 ORDER BY display_name",
    )
    .all(classId) as EduUser[];
}

export function updateUser(
  db: DatabaseSync,
  userId: string,
  updates: Partial<Pick<EduUser, "display_name" | "grade_level" | "class_id" | "role" | "is_active" | "avatar_url">>,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return;

  fields.push("updated_at = datetime('now')");
  values.push(userId);

  db.prepare(
    `UPDATE edu_users SET ${fields.join(", ")} WHERE user_id = ?`,
  ).run(...values);
}

// ── Class Queries ─────────────────────────────────────────────

export function insertClass(
  db: DatabaseSync,
  cls: Omit<EduClass, "created_at" | "updated_at">,
): void {
  const stmt = db.prepare(`
    INSERT INTO edu_classes (
      class_id, school_id, name, grade_level, teacher_user_id,
      subject, is_active, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    cls.class_id,
    cls.school_id,
    cls.name,
    cls.grade_level,
    cls.teacher_user_id ?? null,
    cls.subject ?? null,
    cls.is_active,
    cls.metadata_json,
  );
}

export function listClasses(
  db: DatabaseSync,
  schoolId: string,
): EduClass[] {
  return db
    .prepare(
      "SELECT * FROM edu_classes WHERE school_id = ? AND is_active = 1 ORDER BY grade_level, name",
    )
    .all(schoolId) as EduClass[];
}

// ── Enrollment Queries ────────────────────────────────────────

export function enrollStudent(
  db: DatabaseSync,
  enrollmentId: string,
  userId: string,
  classId: string,
): void {
  db.prepare(
    "INSERT OR IGNORE INTO edu_enrollments (enrollment_id, user_id, class_id) VALUES (?, ?, ?)",
  ).run(enrollmentId, userId, classId);
}

export function getStudentClasses(
  db: DatabaseSync,
  userId: string,
): EduEnrollment[] {
  return db
    .prepare("SELECT * FROM edu_enrollments WHERE user_id = ?")
    .all(userId) as EduEnrollment[];
}

// ── School Queries ────────────────────────────────────────────

export function ensureSchool(
  db: DatabaseSync,
  schoolId: string,
  schoolName: string,
): void {
  const existing = db
    .prepare("SELECT school_id FROM edu_schools WHERE school_id = ?")
    .get(schoolId);
  if (!existing) {
    db.prepare(
      "INSERT INTO edu_schools (school_id, name) VALUES (?, ?)",
    ).run(schoolId, schoolName);
  }
}
