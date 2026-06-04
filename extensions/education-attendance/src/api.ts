/**
 * HTTP API routes for education attendance.
 *
 * Registers REST endpoints under /edu/attendance/* for:
 * - Recording attendance (teacher/admin)
 * - Viewing class attendance by date
 * - Personal attendance history & monthly stats
 */

import type { DatabaseSync } from "node:sqlite";
import type { TenantScope } from "../education-auth/src/tenant-resolver.js";
import type {
  EduContextResolver,
  EduContext,
} from "../education-auth/src/rbac-middleware.js";
import { checkPermission } from "../education-auth/src/rbac-middleware.js";
import {
  recordAttendance,
  batchRecordAttendance,
  getClassAttendanceSummary,
  getUserMonthlyStats,
  initAttendance,
  type BatchRecordInput,
} from "./attendance-service.js";
import { VALID_STATUSES, type AttendanceStatus } from "./db.js";

export interface AttendanceApiDeps {
  db: DatabaseSync;
  tenant: TenantScope;
  resolveContext: EduContextResolver;
}

/** Extract edu context from HTTP headers. */
function extractContext(
  deps: AttendanceApiDeps,
  headers: Record<string, string | string[] | undefined>,
): EduContext | null {
  const authId =
    typeof headers["x-edu-auth-id"] === "string"
      ? headers["x-edu-auth-id"]
      : undefined;
  const senderId =
    typeof headers["x-edu-sender-id"] === "string"
      ? headers["x-edu-sender-id"]
      : undefined;
  const channelId =
    typeof headers["x-edu-channel"] === "string"
      ? headers["x-edu-channel"]
      : undefined;

  return deps.resolveContext({
    authIdentifier: authId,
    senderId,
    channelId,
  });
}

async function readBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function errorJson(message: string, status = 400): Response {
  return json({ error: message }, status);
}

export function createAttendanceApiHandler(deps: AttendanceApiDeps) {
  // Ensure schema exists
  initAttendance(deps.db, deps.tenant.schoolId);

  return async function attendanceApiHandler(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "");
    const method = req.method.toUpperCase();

    // ── POST /edu/attendance — record single attendance ──────────
    if (path === "/edu/attendance" && method === "POST") {
      const ctx = extractContext(deps, {});
      const perm = checkPermission(ctx, "attendance:record");
      if (!perm.allowed) return errorJson(perm.reason!, 403);

      const body = (await readBody(req)) as {
        user_id: string;
        class_id: string;
        date: string;
        status: AttendanceStatus;
        remark?: string;
      };

      if (!body.user_id || !body.class_id || !body.date || !body.status) {
        return errorJson("缺少必填字段: user_id, class_id, date, status", 400);
      }
      if (!VALID_STATUSES.includes(body.status)) {
        return errorJson(
          `无效的考勤状态: ${body.status}，支持: ${VALID_STATUSES.join(", ")}`,
          400,
        );
      }

      const result = recordAttendance(deps.db, deps.tenant.schoolId, {
        user_id: body.user_id,
        class_id: body.class_id,
        date: body.date,
        status: body.status,
        recorded_by: ctx?.user_id ?? "unknown",
        remark: body.remark,
      });

      if (!result.success) return errorJson(result.error!, 400);
      return json(result, 201);
    }

    // ── POST /edu/attendance/batch — batch record whole class ────
    if (path === "/edu/attendance/batch" && method === "POST") {
      const ctx = extractContext(deps, {});
      const perm = checkPermission(ctx, "attendance:record");
      if (!perm.allowed) return errorJson(perm.reason!, 403);

      const body = (await readBody(req)) as BatchRecordInput;
      if (!body.class_id || !body.date || !body.records) {
        return errorJson("缺少必填字段: class_id, date, records", 400);
      }

      const result = batchRecordAttendance(deps.db, deps.tenant.schoolId, {
        ...body,
        recorded_by: ctx?.user_id ?? "unknown",
      });

      return json(result, result.success ? 201 : 207);
    }

    // ── GET /edu/attendance?class_id=&date= — view class summary ──
    if (path === "/edu/attendance" && method === "GET") {
      const classId = url.searchParams.get("class_id");
      const date = url.searchParams.get("date");

      if (!classId || !date) {
        return errorJson("缺少查询参数: class_id, date", 400);
      }

      const ctx = extractContext(deps, {});

      // Students can only view their own class's attendance
      if (ctx?.role === "student") {
        if (ctx.class_id !== classId) {
          return errorJson("只能查看自己班级的考勤", 403);
        }
        const perm = checkPermission(ctx, "attendance:view_own");
        if (!perm.allowed) return errorJson(perm.reason!, 403);
      } else {
        const perm = checkPermission(ctx, "attendance:view_class");
        if (!perm.allowed) return errorJson(perm.reason!, 403);
      }

      // Tenant check
      if (!deps.tenant.classBelongsToSchool(classId)) {
        return errorJson("班级不属于本学校", 403);
      }

      const summary = getClassAttendanceSummary(deps.db, classId, date);
      return json(summary);
    }

    // ── GET /edu/attendance/my?month= — my attendance ────────────
    if (path === "/edu/attendance/my" && method === "GET") {
      const ctx = extractContext(deps, {});
      if (!ctx) return errorJson("未登录教育系统", 401);
      const perm = checkPermission(ctx, "attendance:view_own");
      if (!perm.allowed) return errorJson(perm.reason!, 403);

      const now = new Date();
      const yearMonth =
        url.searchParams.get("month") ??
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      const stats = getUserMonthlyStats(deps.db, ctx.user_id, yearMonth);
      return json(stats);
    }

    // ── GET /edu/attendance/stats?user_id=&month= — user stats ───
    if (path === "/edu/attendance/stats" && method === "GET") {
      const ctx = extractContext(deps, {});
      const targetUserId = url.searchParams.get("user_id");
      const yearMonth = url.searchParams.get("month");

      if (!targetUserId || !yearMonth) {
        return errorJson("缺少查询参数: user_id, month", 400);
      }

      // Only teachers/admins can view others' stats; students view their own
      if (targetUserId !== ctx?.user_id) {
        const perm = checkPermission(ctx, "attendance:view_class");
        if (!perm.allowed) return errorJson(perm.reason!, 403);
      } else {
        const perm = checkPermission(ctx, "attendance:view_own");
        if (!perm.allowed) return errorJson(perm.reason!, 403);
      }

      const stats = getUserMonthlyStats(deps.db, targetUserId, yearMonth);
      return json(stats);
    }

    // ── GET /edu/attendance/unchecked?class_id=&date= — unchecked students
    if (path === "/edu/attendance/unchecked" && method === "GET") {
      const ctx = extractContext(deps, {});
      const perm = checkPermission(ctx, "attendance:view_class");
      if (!perm.allowed) return errorJson(perm.reason!, 403);

      const classId = url.searchParams.get("class_id");
      const date = url.searchParams.get("date");
      if (!classId || !date) {
        return errorJson("缺少查询参数: class_id, date", 400);
      }

      if (!deps.tenant.classBelongsToSchool(classId)) {
        return errorJson("班级不属于本学校", 403);
      }

      const summary = getClassAttendanceSummary(deps.db, classId, date);
      return json({
        class_id: classId,
        date,
        unchecked_count: summary.unchecked,
        unchecked_students: summary.unchecked_students,
      });
    }

    return errorJson("Not Found", 404);
  };
}
