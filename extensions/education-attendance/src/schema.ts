/**
 * SQL schema for education attendance tables.
 *
 * Uses the shared education SQLite database (same as education-auth).
 * The attendance table is added to the existing education DB.
 */

export const ATTENDANCE_SCHEMA_VERSION = 1;

/** SQL to create attendance tables. Appended to existing education DB. */
export const ATTENDANCE_SCHEMA_SQL = `
-- Attendance records
CREATE TABLE IF NOT EXISTS edu_attendance (
  attendance_id  TEXT PRIMARY KEY NOT NULL,
  user_id        TEXT NOT NULL REFERENCES edu_users(user_id),
  class_id       TEXT NOT NULL REFERENCES edu_classes(class_id),
  school_id      TEXT NOT NULL REFERENCES edu_schools(school_id),
  date           TEXT NOT NULL,          -- YYYY-MM-DD
  status         TEXT NOT NULL CHECK (status IN ('present','late','absent','leave')),
  recorded_by    TEXT NOT NULL,          -- teacher user_id who recorded
  remark         TEXT DEFAULT '',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_class_date
  ON edu_attendance(class_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_user
  ON edu_attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_school_date
  ON edu_attendance(school_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_user_month
  ON edu_attendance(user_id, substr(date, 1, 7));

-- Schema version tracking (idempotent insert)
INSERT OR IGNORE INTO edu_schema_meta (key, value)
  VALUES ('attendance_schema_version', '${ATTENDANCE_SCHEMA_VERSION}');
`.trim();
