/**
 * RBAC (Role-Based Access Control) middleware.
 *
 * Registers hooks on the message pipeline to:
 * 1. Resolve caller identity (channel sender → edu_user)
 * 2. Check role permissions before allowing tool calls
 * 3. Attach edu context (user_id, role, school_id, class_id) to messages
 */

import type { DatabaseSync } from "node:sqlite";
import type { EduRole, EduPermission } from "./roles.js";
import { roleHasPermission } from "./roles.js";
import { findUserByChannel, findUserByAuthIdentifier } from "./db.js";
import type { EduUser } from "./db.js";

/** Education context attached to each message/request. */
export interface EduContext {
  user_id: string;
  school_id: string;
  role: EduRole;
  display_name: string;
  class_id: string | null;
  grade_level: string | null;
}

/** Callback to resolve the current education context from a message. */
export type EduContextResolver = (params: {
  channelId?: string;
  authIdentifier?: string;
  senderId?: string;
}) => EduContext | null;

/**
 * Create a context resolver backed by the education database.
 */
export function createEduContextResolver(
  db: DatabaseSync,
  schoolId: string,
): EduContextResolver {
  return (params): EduContext | null => {
    let user: EduUser | undefined;

    // Try channel-based lookup first (for messaging platforms)
    if (params.channelId && params.senderId) {
      const channelKey = `${params.channelId}:${params.senderId}`;
      user = findUserByChannel(db, schoolId, channelKey);
    }

    // Fall back to auth identifier (for web login)
    if (!user && params.authIdentifier) {
      user = findUserByAuthIdentifier(db, params.authIdentifier);
    }

    if (!user || !user.is_active) return null;

    return {
      user_id: user.user_id,
      school_id: user.school_id,
      role: user.role,
      display_name: user.display_name,
      class_id: user.class_id,
      grade_level: user.grade_level,
    };
  };
}

/**
 * Check whether an education context is authorized for a given permission.
 * Returns { allowed: boolean, reason?: string }.
 */
export function checkPermission(
  ctx: EduContext | null,
  permission: EduPermission,
): { allowed: boolean; reason?: string } {
  if (!ctx) {
    return {
      allowed: false,
      reason: "未登录教育系统。请先联系管理员注册账号。",
    };
  }

  if (!roleHasPermission(ctx.role, permission)) {
    return {
      allowed: false,
      reason: `角色 "${ctx.role}" 没有执行 "${permission}" 操作的权限。`,
    };
  }

  return { allowed: true };
}

/**
 * Verify that a user can access data belonging to another user.
 * Students can only access their own data.
 * Parents can only access their linked children's data.
 * Teachers can access data for students in their classes.
 * Admins can access everything.
 */
export function canAccessUserData(
  ctx: EduContext,
  targetUserId: string,
  db: DatabaseSync,
): boolean {
  if (ctx.role === "admin") return true;
  if (ctx.user_id === targetUserId) return true;

  if (ctx.role === "parent") {
    // Check if target is the parent's linked child
    const user = db
      .prepare(
        "SELECT parent_of_user_id FROM edu_users WHERE user_id = ?",
      )
      .get(targetUserId) as { parent_of_user_id: string | null } | undefined;
    return user?.parent_of_user_id === ctx.user_id;
  }

  if (ctx.role === "teacher") {
    // Check if target is in one of the teacher's classes
    const enrolled = db
      .prepare(
        `SELECT 1 FROM edu_enrollments e
         JOIN edu_classes c ON e.class_id = c.class_id
         WHERE e.user_id = ? AND c.teacher_user_id = ?`,
      )
      .get(targetUserId, ctx.user_id);
    return enrolled !== undefined;
  }

  return false;
}
