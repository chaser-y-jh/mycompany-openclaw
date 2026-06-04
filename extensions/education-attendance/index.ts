/**
 * Education Attendance Plugin — 考勤打卡系统.
 *
 * Phase 1 sub-module of the K12 education platform.
 * Provides: teacher roll-call, batch attendance, monthly stats.
 * Depends on: education-auth (for user/class context and RBAC).
 */

import { definePluginEntry } from "merclaw/plugin-sdk/plugin-entry";
import type { MerClawPluginApi } from "merclaw/plugin-sdk/plugin-entry";
import { resolvePluginConfigObject } from "merclaw/plugin-sdk/plugin-config-runtime";
import type { MerClawConfig } from "merclaw/plugin-sdk/config-contracts";
import { getEduDb } from "../education-auth/src/db.js";
import {
  createEduContextResolver,
} from "../education-auth/src/rbac-middleware.js";
import { createTenantScope } from "../education-auth/src/tenant-resolver.js";
import { createAttendanceApiHandler } from "./src/api.js";
import { initAttendance } from "./src/attendance-service.js";
import { getClassAttendanceSummary, getUserMonthlyStats } from "./src/attendance-service.js";

/** Plugin-level config shape. */
interface AttendanceConfig {
  enabled?: boolean;
  schoolId?: string;
  autoMarkAbsentAfter?: string;
  allowStudentSelfCheckIn?: boolean;
}

function resolveConfig(config?: MerClawConfig): AttendanceConfig {
  const pluginConfig = resolvePluginConfigObject(
    config,
    "education-attendance",
  ) as AttendanceConfig | undefined;
  return pluginConfig ?? {};
}

export default definePluginEntry({
  id: "education-attendance",
  name: "Education Attendance",
  description:
    "考勤打卡系统 — 教师点名、学生出勤统计。支持 present/late/absent/leave 四种状态。",
  register(api: MerClawPluginApi) {
    const cfg = resolveConfig(api.config);
    if (!cfg.enabled) {
      api.logger.info?.(
        "[education-attendance] Attendance mode disabled, skipping init",
      );
      return;
    }

    const schoolId = cfg.schoolId ?? "default-school";

    // Reuse the education DB from education-auth
    const stateDir =
      api.runtime?.stateDir ??
      process.env.MERCLAW_STATE_DIR ??
      process.env.HOME + "/.merclaw";
    const db = getEduDb(stateDir);
    const tenant = createTenantScope(db, schoolId);

    // Initialize attendance schema
    initAttendance(db, schoolId);

    // Reuse the context resolver from education-auth
    const resolveContext = createEduContextResolver(db, schoolId);

    // ── Register HTTP API routes ──────────────────────────────────
    const handler = createAttendanceApiHandler({
      db,
      tenant,
      resolveContext,
    });

    api.registerHttpRoute({
      path: "/edu/attendance",
      auth: "plugin",
      match: "prefix",
      handler: async (req) => {
        return await handler(req);
      },
    });

    api.logger.info?.(
      `[education-attendance] Registered /edu/attendance/* routes for school "${schoolId}"`,
    );

    // ── Register tools ────────────────────────────────────────────

    // Tool: record_attendance — record a single student's attendance
    api.registerTool({
      name: "record_attendance",
      description:
        "记录单个学生的考勤状态。支持 present（到勤）、late（迟到）、absent（缺勤）、leave（请假）四种状态。",
      parameters: {
        type: "object",
        properties: {
          user_id: {
            type: "string",
            description: "学生用户ID",
          },
          class_id: {
            type: "string",
            description: "班级ID",
          },
          date: {
            type: "string",
            description: "日期，格式 YYYY-MM-DD",
          },
          status: {
            type: "string",
            enum: ["present", "late", "absent", "leave"],
            description: "考勤状态",
          },
          remark: {
            type: "string",
            description: "备注（如迟到原因、请假原因等）",
          },
        },
        required: ["user_id", "class_id", "date", "status"],
      },
      async execute(_toolCallId, params: unknown) {
        const p = params as {
          user_id: string;
          class_id: string;
          date: string;
          status: "present" | "late" | "absent" | "leave";
          remark?: string;
        };

        const { recordAttendance } = await import(
          "./src/attendance-service.js"
        );
        const result = recordAttendance(db, schoolId, {
          user_id: p.user_id,
          class_id: p.class_id,
          date: p.date,
          status: p.status,
          recorded_by: "system-tool",
          remark: p.remark,
        });
        return result;
      },
    });

    // Tool: get_class_attendance — view class attendance summary
    api.registerTool({
      name: "get_class_attendance",
      description:
        "查看某班级在某天的考勤汇总，包括到勤、迟到、缺勤、请假人数，以及未打卡学生名单。",
      parameters: {
        type: "object",
        properties: {
          class_id: {
            type: "string",
            description: "班级ID",
          },
          date: {
            type: "string",
            description: "日期，格式 YYYY-MM-DD",
          },
        },
        required: ["class_id", "date"],
      },
      async execute(_toolCallId, params: unknown) {
        const p = params as { class_id: string; date: string };
        if (!tenant.classBelongsToSchool(p.class_id)) {
          return { error: "班级不属于本学校" };
        }
        return getClassAttendanceSummary(db, p.class_id, p.date);
      },
    });

    // Tool: get_attendance_stats — monthly stats for a student
    api.registerTool({
      name: "get_attendance_stats",
      description:
        "查看某学生的月度考勤统计，包括出勤天数、迟到次数、缺勤次数、请假次数和出勤率。",
      parameters: {
        type: "object",
        properties: {
          user_id: {
            type: "string",
            description: "学生用户ID",
          },
          month: {
            type: "string",
            description: "月份，格式 YYYY-MM，不填则默认当前月",
          },
        },
        required: ["user_id"],
      },
      async execute(_toolCallId, params: unknown) {
        const p = params as { user_id: string; month?: string };
        const now = new Date();
        const yearMonth =
          p.month ??
          `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

        return getUserMonthlyStats(db, p.user_id, yearMonth);
      },
    });

    // ── Register service for lifecycle ────────────────────────────
    api.registerService({
      id: "education-attendance-service",
      start: async () => {
        api.logger.info?.(
          `[education-attendance] Started — auto-absent: ${cfg.autoMarkAbsentAfter ?? "30min"}, self-checkin: ${cfg.allowStudentSelfCheckIn ?? false}`,
        );
      },
      stop: async () => {
        api.logger.info?.("[education-attendance] Stopped");
      },
    });

    api.logger.info?.(
      "[education-attendance] Attendance plugin registered successfully",
    );
  },
});
