/**
 * Database access layer for education attendance.
 *
 * Shares the education SQLite database with education-auth.
 * Uses the existing getEduDb / closeEduDb from education-auth.
 */

import type { DatabaseSync } from "node:sqlite";
import { ATTENDANCE_SCHEMA_SQL } from "./schema.js";

export interface AttendanceRecord {
  attendance_id: string;
  user_id: string;
  class_id: string;
  school_id: string;
  date: string;
  status: "present" | "late" | "absent" | "leave";
  recorded_by: string;
  remark: string;
  created_at: string;
  updated_at: string;
}

export type AttendanceStatus = "present" | "late" | "absent" | "leave";

export const VALID_STATUSES: AttendanceStatus[] = [
  "present",
  "late",
  "absent",
  "leave",
];

/** Ensure attendance tables exist in the education DB. */
export function ensureAttendanceSchema(db: DatabaseSync): void {
  db.exec(ATTENDANCE_SCHEMA_SQL);
}

// ── Insert ─────────────────────────────────────────────────────

export function insertAttendance(
  db: DatabaseSync,
  record: Omit<AttendanceRecord, "created_at" | "updated_at">,
): void {
  db.prepare(`
    INSERT OR REPLACE INTO edu_attendance (
      attendance_id, user_id, class_id, school_id,
      date, status, recorded_by, remark
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.attendance_id,
    record.user_id,
    record.class_id,
    record.school_id,
    record.date,
    record.status,
    record.recorded_by,
    record.remark,
  );
}

// ── Query ──────────────────────────────────────────────────────

/** Get attendance for a specific user on a specific date. */
export function getAttendanceByUserDate(
  db: DatabaseSync,
  userId: string,
  date: string,
): AttendanceRecord | undefined {
  return db
    .prepare(
      "SELECT * FROM edu_attendance WHERE user_id = ? AND date = ?",
    )
    .get(userId, date) as AttendanceRecord | undefined;
}

/** List attendance records for a class on a specific date. */
export function listAttendanceByClassDate(
  db: DatabaseSync,
  classId: string,
  date: string,
): (AttendanceRecord & { display_name: string; role: string })[] {
  return db
    .prepare(`
      SELECT a.*, u.display_name, u.role
      FROM edu_attendance a
      JOIN edu_users u ON a.user_id = u.user_id
      WHERE a.class_id = ? AND a.date = ?
      ORDER BY u.display_name
    `)
    .all(classId, date) as (AttendanceRecord & { display_name: string; role: string })[];
}

/** Get monthly attendance stats for a user. */
export function getMonthlyStats(
  db: DatabaseSync,
  userId: string,
  yearMonth: string, // e.g. "2026-06"
): {
  total: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
  rate: number;
} {
  const rows = db
    .prepare(`
      SELECT status, COUNT(*) as cnt
      FROM edu_attendance
      WHERE user_id = ? AND substr(date, 1, 7) = ?
      GROUP BY status
    `)
    .all(userId, yearMonth) as { status: string; cnt: number }[];

  let present = 0,
    late = 0,
    absent = 0,
    leave = 0;
  for (const r of rows) {
    switch (r.status) {
      case "present":
        present = r.cnt;
        break;
      case "late":
        late = r.cnt;
        break;
      case "absent":
        absent = r.cnt;
        break;
      case "leave":
        leave = r.cnt;
        break;
    }
  }
  const total = present + late + absent + leave;
  // 出勤率 = (到勤 + 迟到) / 总天数（不含请假）
  const effective = present + late + absent;
  const rate = effective > 0 ? ((present + late) / effective) * 100 : 100;

  return {
    total,
    present,
    late,
    absent,
    leave,
    rate: Math.round(rate * 10) / 10,
  };
}

/** Batch record attendance for multiple students at once. */
export function batchInsertAttendance(
  db: DatabaseSync,
  records: Omit<AttendanceRecord, "created_at" | "updated_at">[],
  schoolId: string,
): void {
  const upsert = db.prepare(`
    INSERT INTO edu_attendance (
      attendance_id, user_id, class_id, school_id,
      date, status, recorded_by, remark
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, date) DO UPDATE SET
      status = excluded.status,
      recorded_by = excluded.recorded_by,
      remark = excluded.remark,
      updated_at = datetime('now')
  `);

  for (const r of records) {
    upsert.run(
      r.attendance_id,
      r.user_id,
      r.class_id,
      schoolId,
      r.date,
      r.status,
      r.recorded_by,
      r.remark,
    );
  }
}

/** Get students in a class who have NO attendance record for a given date. */
export function getStudentsWithoutAttendance(
  db: DatabaseSync,
  classId: string,
  date: string,
): { user_id: string; display_name: string }[] {
  return db
    .prepare(`
      SELECT u.user_id, u.display_name
      FROM edu_users u
      WHERE u.class_id = ? AND u.is_active = 1 AND u.role = 'student'
      AND u.user_id NOT IN (
        SELECT a.user_id FROM edu_attendance a WHERE a.class_id = ? AND a.date = ?
      )
      ORDER BY u.display_name
    `)
    .all(classId, classId, date) as { user_id: string; display_name: string }[];
}
