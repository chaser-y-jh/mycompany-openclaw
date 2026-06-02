/**
 * User registry — CRUD operations for education users.
 *
 * Exposes functions to create, read, update, and soft-delete
 * users, classes, and enrollments. All operations are
 * tenant-scoped (per school).
 */

import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { EduRole } from "./roles.js";
import { isValidRole } from "./roles.js";
import {
  insertUser,
  findUserById,
  findUserByChannel,
  listUsersByRole,
  listUsersByClass,
  updateUser,
  insertClass,
  listClasses,
  enrollStudent,
  getStudentClasses,
  ensureSchool,
} from "./db.js";
import type { TenantScope } from "./tenant-resolver.js";

// ── User Management ───────────────────────────────────────────

export interface CreateUserInput {
  role: EduRole;
  display_name: string;
  grade_level?: string;
  class_id?: string;
  parent_of_user_id?: string;
  channel_id?: string;
  auth_identifier?: string;
  avatar_url?: string;
}

export interface CreateUserResult {
  success: boolean;
  user_id?: string;
  error?: string;
}

export function createUser(
  db: DatabaseSync,
  tenant: TenantScope,
  input: CreateUserInput,
): CreateUserResult {
  if (!isValidRole(input.role)) {
    return { success: false, error: `无效的角色: ${input.role}` };
  }

  // If class_id provided, verify it belongs to this school
  if (input.class_id && !tenant.classBelongsToSchool(input.class_id)) {
    return { success: false, error: "班级不属于本学校" };
  }

  // If channel_id provided, check for duplicates
  if (input.channel_id) {
    const existing = findUserByChannel(
      db,
      tenant.schoolId,
      input.channel_id,
    );
    if (existing) {
      return { success: false, error: "该渠道账号已被注册" };
    }
  }

  const userId = `edu-user-${randomUUID()}`;

  try {
    insertUser(db, {
      user_id: userId,
      school_id: tenant.schoolId,
      role: input.role,
      display_name: input.display_name,
      grade_level: input.grade_level ?? null,
      class_id: input.class_id ?? null,
      parent_of_user_id: input.parent_of_user_id ?? null,
      channel_id: input.channel_id ?? null,
      auth_identifier: input.auth_identifier ?? null,
      avatar_url: input.avatar_url ?? null,
      is_active: 1,
      metadata_json: "{}",
    });
    return { success: true, user_id: userId };
  } catch (err) {
    return {
      success: false,
      error: `创建用户失败: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export interface UserInfo {
  user_id: string;
  school_id: string;
  role: EduRole;
  display_name: string;
  grade_level: string | null;
  class_id: string | null;
  class_name?: string | null;
  avatar_url: string | null;
  is_active: number;
  created_at: string;
}

export function getUserInfo(
  db: DatabaseSync,
  tenant: TenantScope,
  userId: string,
): UserInfo | null {
  const user = findUserById(db, userId);
  if (!user) return null;
  if (user.school_id !== tenant.schoolId) return null;

  let className: string | null = null;
  if (user.class_id) {
    const cls = db
      .prepare("SELECT name FROM edu_classes WHERE class_id = ?")
      .get(user.class_id) as { name: string } | undefined;
    className = cls?.name ?? null;
  }

  return {
    user_id: user.user_id,
    school_id: user.school_id,
    role: user.role,
    display_name: user.display_name,
    grade_level: user.grade_level,
    class_id: user.class_id,
    class_name: className,
    avatar_url: user.avatar_url,
    is_active: user.is_active,
    created_at: user.created_at,
  };
}

export function listUsers(
  db: DatabaseSync,
  tenant: TenantScope,
  options: { role?: EduRole; class_id?: string } = {},
): UserInfo[] {
  let users;
  if (options.class_id) {
    if (!tenant.classBelongsToSchool(options.class_id)) return [];
    users = listUsersByClass(db, options.class_id);
  } else if (options.role) {
    users = listUsersByRole(db, tenant.schoolId, options.role);
  } else {
    // List all users in school
    users = db
      .prepare(
        "SELECT * FROM edu_users WHERE school_id = ? AND is_active = 1 ORDER BY role, display_name",
      )
      .all(tenant.schoolId) as import("./db.js").EduUser[];
  }

  return users.map((u) => ({
    user_id: u.user_id,
    school_id: u.school_id,
    role: u.role,
    display_name: u.display_name,
    grade_level: u.grade_level,
    class_id: u.class_id,
    avatar_url: u.avatar_url,
    is_active: u.is_active,
    created_at: u.created_at,
  }));
}

export function deactivateUser(
  db: DatabaseSync,
  tenant: TenantScope,
  userId: string,
): { success: boolean; error?: string } {
  if (!tenant.userBelongsToSchool(userId)) {
    return { success: false, error: "用户不属于本学校" };
  }
  updateUser(db, userId, { is_active: 0 });
  return { success: true };
}

// ── Class Management ──────────────────────────────────────────

export interface CreateClassInput {
  name: string;
  grade_level: string;
  teacher_user_id?: string;
  subject?: string;
}

export function createClass(
  db: DatabaseSync,
  tenant: TenantScope,
  input: CreateClassInput,
): { success: boolean; class_id?: string; error?: string } {
  const classId = `edu-class-${randomUUID()}`;

  try {
    insertClass(db, {
      class_id: classId,
      school_id: tenant.schoolId,
      name: input.name,
      grade_level: input.grade_level,
      teacher_user_id: input.teacher_user_id ?? null,
      subject: input.subject ?? null,
      is_active: 1,
      metadata_json: "{}",
    });
    return { success: true, class_id: classId };
  } catch (err) {
    return {
      success: false,
      error: `创建班级失败: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export function getClasses(
  db: DatabaseSync,
  tenant: TenantScope,
): Array<{
  class_id: string;
  name: string;
  grade_level: string;
  teacher_user_id: string | null;
  student_count: number;
}> {
  const classes = listClasses(db, tenant.schoolId);
  return classes.map((c) => {
    const countRow = db
      .prepare(
        "SELECT COUNT(*) as cnt FROM edu_enrollments WHERE class_id = ?",
      )
      .get(c.class_id) as { cnt: number };
    return {
      class_id: c.class_id,
      name: c.name,
      grade_level: c.grade_level,
      teacher_user_id: c.teacher_user_id,
      student_count: countRow?.cnt ?? 0,
    };
  });
}

// ── Enrollment ────────────────────────────────────────────────

export function addStudentToClass(
  db: DatabaseSync,
  tenant: TenantScope,
  userId: string,
  classId: string,
): { success: boolean; error?: string } {
  if (!tenant.userBelongsToSchool(userId)) {
    return { success: false, error: "学生不属于本学校" };
  }
  if (!tenant.classBelongsToSchool(classId)) {
    return { success: false, error: "班级不属于本学校" };
  }

  const enrollmentId = `edu-enr-${randomUUID()}`;
  enrollStudent(db, enrollmentId, userId, classId);

  // Also update the user's class_id
  updateUser(db, userId, { class_id: classId });

  return { success: true };
}

// ── School Initialization ─────────────────────────────────────

export function initSchool(
  db: DatabaseSync,
  schoolId: string,
  schoolName: string,
  adminName?: string,
  adminChannelId?: string,
): { adminUserId?: string; error?: string } {
  ensureSchool(db, schoolId, schoolName);

  if (adminName) {
    // Check if an admin already exists for this school
    const existingAdmins = listUsersByRole(db, schoolId, "admin");
    if (existingAdmins.length === 0) {
      const adminUserId = `edu-user-${randomUUID()}`;
      insertUser(db, {
        user_id: adminUserId,
        school_id: schoolId,
        role: "admin",
        display_name: adminName,
        grade_level: null,
        class_id: null,
        parent_of_user_id: null,
        channel_id: adminChannelId ?? null,
        auth_identifier: null,
        avatar_url: null,
        is_active: 1,
        metadata_json: JSON.stringify({ initialAdmin: true }),
      });
      return { adminUserId };
    }
  }

  return {};
}
