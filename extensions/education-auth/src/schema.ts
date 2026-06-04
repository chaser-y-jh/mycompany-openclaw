/**
 * SQL schema for education auth tables.
 *
 * These tables live in a dedicated education SQLite database
 * (separate from the core MerClaw state DB) for clean plugin isolation.
 */

export const EDU_AUTH_SCHEMA_VERSION = 1;

/** SQL statements to create education auth tables. */
export const EDU_AUTH_SCHEMA_SQL = `
-- Education schools
CREATE TABLE IF NOT EXISTS edu_schools (
  school_id    TEXT PRIMARY KEY NOT NULL,
  name         TEXT NOT NULL,
  config_json  TEXT DEFAULT '{}',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Education users
CREATE TABLE IF NOT EXISTS edu_users (
  user_id            TEXT PRIMARY KEY NOT NULL,
  school_id          TEXT NOT NULL REFERENCES edu_schools(school_id),
  role               TEXT NOT NULL CHECK (role IN ('student','teacher','parent','admin')),
  display_name       TEXT NOT NULL,
  grade_level        TEXT,           -- e.g. 'grade-7', 'grade-10'
  class_id           TEXT,           -- FK to edu_classes
  parent_of_user_id  TEXT,           -- If role=parent, links to child student
  channel_id         TEXT,           -- e.g. 'whatsapp:+1234567890'
  auth_identifier    TEXT,           -- login name or phone hash for identity lookup
  avatar_url         TEXT,
  is_active          INTEGER NOT NULL DEFAULT 1,
  metadata_json      TEXT DEFAULT '{}',
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_edu_users_school ON edu_users(school_id);
CREATE INDEX IF NOT EXISTS idx_edu_users_role ON edu_users(school_id, role);
CREATE INDEX IF NOT EXISTS idx_edu_users_auth ON edu_users(auth_identifier);
CREATE UNIQUE INDEX IF NOT EXISTS idx_edu_users_channel
  ON edu_users(school_id, channel_id) WHERE channel_id IS NOT NULL;

-- Education classes
CREATE TABLE IF NOT EXISTS edu_classes (
  class_id       TEXT PRIMARY KEY NOT NULL,
  school_id      TEXT NOT NULL REFERENCES edu_schools(school_id),
  name           TEXT NOT NULL,         -- e.g. '三年级一班'
  grade_level    TEXT NOT NULL,         -- e.g. 'grade-3'
  teacher_user_id TEXT,                 -- homeroom teacher
  subject        TEXT,                  -- subject taught (if subject-specific class)
  is_active      INTEGER NOT NULL DEFAULT 1,
  metadata_json  TEXT DEFAULT '{}',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_edu_classes_school ON edu_classes(school_id);
CREATE INDEX IF NOT EXISTS idx_edu_classes_teacher ON edu_classes(teacher_user_id);

-- Education enrollments (student ↔ class mapping)
CREATE TABLE IF NOT EXISTS edu_enrollments (
  enrollment_id TEXT PRIMARY KEY NOT NULL,
  user_id       TEXT NOT NULL REFERENCES edu_users(user_id),
  class_id      TEXT NOT NULL REFERENCES edu_classes(class_id),
  enrolled_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_edu_enrollments_user ON edu_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_edu_enrollments_class ON edu_enrollments(class_id);

-- Schema version tracking
CREATE TABLE IF NOT EXISTS edu_schema_meta (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT
);

INSERT OR IGNORE INTO edu_schema_meta (key, value) VALUES ('schema_version', '${EDU_AUTH_SCHEMA_VERSION}');
`.trim();
