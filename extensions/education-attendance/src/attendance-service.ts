/**
 * Attendance business logic — recording, querying, stats calculation.
 *
 * All operations are tenant-scoped (per school) and permission-checked
 * at the API layer before calling these functions.
 */

import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import {
  insertAttendance,
  getAttendanceByUserDate,
  listAttendanceByClassDate,
  getMonthlyStats,
  batchInsertAttendance,
  getStudentsWithoutAttendance,
  ensureAttendanceSchema,
  type AttendanceStatus,
  type AttendanceRecord,
} from "./db.js";

export interface RecordAttendanceInput {
  user_id: string;
  class_id: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  recorded_by: string;
  remark?: string;
}

export interface BatchRecordInput {
  class_id: string;
  date: string;
  records: { user_id: string; status: AttendanceStatus; remark?: string }[];
  recorded_by: string;
}

export interface RecordResult {
  success: boolean;
  attendance_id?: string;
  error?: string;
}

export interface BatchRecordResult {
  success: boolean;
  recorded: number;
  errors: string[];
}

export interface AttendanceSummary {
  class_id: string;
  date: string;
  total_students: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
  unchecked: number;
  records: (AttendanceRecord & { display_name: string; role: string })[];
  unchecked_students: { user_id: string; display_name: string }[];
}

export interface MonthlyStats {
  user_id: string;
  year_month: string;
  total: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
  rate: number;
}

/** Initialize attendance schema (idempotent). */
export function initAttendance(db: DatabaseSync, schoolId: string): void {
  ensureAttendanceSchema(db);
}

/** Record a single student's attendance. */
export function recordAttendance(
  db: DatabaseSync,
  schoolId: string,
  input: RecordAttendanceInput,
): RecordResult {
  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { success: false, error: "日期格式不正确，请使用 YYYY-MM-DD" };
  }

  const attendanceId = `att-${randomUUID()}`;

  try {
    insertAttendance(db, {
      attendance_id: attendanceId,
      user_id: input.user_id,
      class_id: input.class_id,
      school_id: schoolId,
      date: input.date,
      status: input.status,
      recorded_by: input.recorded_by,
      remark: input.remark ?? "",
    });
    return { success: true, attendance_id: attendanceId };
  } catch (err) {
    return {
      success: false,
      error: `考勤记录失败: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** Batch record attendance for an entire class. */
export function batchRecordAttendance(
  db: DatabaseSync,
  schoolId: string,
  input: BatchRecordInput,
): BatchRecordResult {
  const errors: string[] = [];
  const toInsert: Omit<AttendanceRecord, "created_at" | "updated_at">[] = [];

  for (const r of input.records) {
    toInsert.push({
      attendance_id: `att-${randomUUID()}`,
      user_id: r.user_id,
      class_id: input.class_id,
      school_id: schoolId,
      date: input.date,
      status: r.status,
      recorded_by: input.recorded_by,
      remark: r.remark ?? "",
    });
  }

  try {
    batchInsertAttendance(db, toInsert, schoolId);
  } catch (err) {
    errors.push(`批量写入失败: ${err instanceof Error ? err.message : String(err)}`);
  }

  return {
    success: errors.length === 0,
    recorded: toInsert.length - errors.length,
    errors,
  };
}

/** Get attendance summary for a class on a specific date. */
export function getClassAttendanceSummary(
  db: DatabaseSync,
  classId: string,
  date: string,
): AttendanceSummary {
  const records = listAttendanceByClassDate(db, classId, date);
  const unchecked = getStudentsWithoutAttendance(db, classId, date);

  let present = 0,
    late = 0,
    absent = 0,
    leave = 0;
  for (const r of records) {
    switch (r.status) {
      case "present":
        present++;
        break;
      case "late":
        late++;
        break;
      case "absent":
        absent++;
        break;
      case "leave":
        leave++;
        break;
    }
  }

  return {
    class_id: classId,
    date,
    total_students: records.length + unchecked.length,
    present,
    late,
    absent,
    leave,
    unchecked: unchecked.length,
    records,
    unchecked_students: unchecked,
  };
}

/** Get monthly attendance stats for a user. */
export function getUserMonthlyStats(
  db: DatabaseSync,
  userId: string,
  yearMonth: string, // "YYYY-MM"
): MonthlyStats {
  const stats = getMonthlyStats(db, userId, yearMonth);
  return {
    user_id: userId,
    year_month: yearMonth,
    ...stats,
  };
}
