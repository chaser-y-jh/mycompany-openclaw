/**
 * Education Auth Plugin — User system, roles, RBAC, multi-tenant isolation.
 *
 * Phase 0 of the K12 education platform transformation.
 * Provides: student/teacher/parent/admin identity, permission-based
 * access control, and school-level data isolation.
 */

import { definePluginEntry } from "merclaw/plugin-sdk/plugin-entry";
import type { MerClawPluginApi } from "merclaw/plugin-sdk/plugin-entry";
import { resolvePluginConfigObject } from "merclaw/plugin-sdk/plugin-config-runtime";
import type { MerClawConfig } from "merclaw/plugin-sdk/config-contracts";
import {
  getEduDb,
  closeEduDb,
  findUserById,
} from "./src/db.js";
import {
  createEduContextResolver,
  checkPermission,
  type EduContext,
} from "./src/rbac-middleware.js";
import { createTenantScope } from "./src/tenant-resolver.js";
import { initSchool } from "./src/user-registry.js";
import { createEduApiHandler } from "./src/api.js";

/** Plugin-level config shape (matches merclaw.plugin.json configSchema). */
interface EducationAuthConfig {
  enabled?: boolean;
  schoolId?: string;
  schoolName?: string;
  authMode?: "phone" | "username" | "sso";
  allowSelfRegistration?: boolean;
  defaultRole?: "student" | "teacher" | "parent" | "admin";
}

function resolveConfig(config?: MerClawConfig): EducationAuthConfig {
  const pluginConfig = resolvePluginConfigObject(
    config,
    "education-auth",
  ) as EducationAuthConfig | undefined;
  return pluginConfig ?? {};
}

export default definePluginEntry({
  id: "education-auth",
  name: "Education Auth",
  description:
    "User system, roles (student/teacher/parent/admin), RBAC, and multi-tenant isolation for K12 education.",
  register(api: MerClawPluginApi) {
    const cfg = resolveConfig(api.config);
    if (!cfg.enabled) {
      api.logger.info?.("[education-auth] Education mode disabled, skipping init");
      return;
    }

    const schoolId = cfg.schoolId ?? "default-school";
    const schoolName = cfg.schoolName ?? "Default School";

    // Initialize the education database
    const stateDir =
      api.runtime?.stateDir ??
      process.env.MERCLAW_STATE_DIR ??
      process.env.HOME + "/.merclaw";
    const db = getEduDb(stateDir);
    const tenant = createTenantScope(db, schoolId);

    // Initialize school record
    initSchool(db, schoolId, schoolName);

    // Create the context resolver for mapping channel/auth → edu user
    const resolveContext = createEduContextResolver(db, schoolId);

    // ── Register HTTP API routes ──────────────────────────────────
    const handler = createEduApiHandler({
      db,
      tenant,
      resolveContext,
    });

    api.registerHttpRoute({
      path: "/edu/",
      auth: "plugin",
      match: "prefix",
      handler: async (req) => {
        // req is an Express-style request; wrap it for our handler
        return await handler(req);
      },
    });

    api.logger.info?.(
      `[education-auth] Registered /edu/* routes for school "${schoolName}" (${schoolId})`,
    );

    // ── Register tools ────────────────────────────────────────────

    // Tool: lookup_edu_user — resolve user identity from channel/sender
    api.registerTool({
      name: "lookup_edu_user",
      description:
        "Look up an education platform user by channel ID or auth identifier. " +
        "Returns the user's role, display name, grade level, and class.",
      parameters: {
        type: "object",
        properties: {
          channel_id: {
            type: "string",
            description: "Channel+Sender combined (e.g. 'whatsapp:+1234567890')",
          },
          auth_identifier: {
            type: "string",
            description: "Auth identifier (login name or phone hash)",
          },
        },
      },
      async execute(_toolCallId, params: unknown) {
        const p = params as { channel_id?: string; auth_identifier?: string };
        const ctx = resolveContext({
          channelId: p.channel_id,
          authIdentifier: p.auth_identifier,
          senderId: p.channel_id,
        });
        if (!ctx) {
          return { found: false, error: "用户未找到" };
        }
        const user = findUserById(db, ctx.user_id);
        return {
          found: true,
          user: user
            ? {
                user_id: user.user_id,
                role: user.role,
                display_name: user.display_name,
                grade_level: user.grade_level,
                class_id: user.class_id,
              }
            : ctx,
        };
      },
    });

    // Tool: check_edu_permission — verify user has a specific permission
    api.registerTool({
      name: "check_edu_permission",
      description:
        "Check whether an education user has a specific permission. " +
        "Returns allowed/denied with a reason.",
      parameters: {
        type: "object",
        properties: {
          permission: {
            type: "string",
            description:
              "Permission to check (e.g. 'chat:tutor', 'homework:grade', 'users:manage')",
          },
          user_id: {
            type: "string",
            description: "The user ID to check (defaults to current caller)",
          },
        },
        required: ["permission"],
      },
      async execute(_toolCallId, params: unknown) {
        const p = params as { permission: string; user_id?: string };
        let ctx: EduContext | null = null;

        if (p.user_id) {
          const user = findUserById(db, p.user_id);
          if (user) {
            ctx = {
              user_id: user.user_id,
              school_id: user.school_id,
              role: user.role,
              display_name: user.display_name,
              class_id: user.class_id,
              grade_level: user.grade_level,
            };
          }
        }

        const result = checkPermission(
          ctx,
          p.permission as import("./src/roles.js").EduPermission,
        );
        return result;
      },
    });

    // ── Register service for lifecycle ────────────────────────────
    api.registerService({
      id: "education-auth-service",
      start: async () => {
        api.logger.info?.(
          `[education-auth] Started — school: ${schoolName}, mode: ${cfg.authMode}`,
        );
      },
      stop: async () => {
        closeEduDb();
        api.logger.info?.("[education-auth] Stopped");
      },
    });

    // ── Register hooks for message interception ────────────────────
    //
    // Hook: before agent processes a message, resolve and attach edu context.
    // This allows downstream tools/plugins to know who the caller is.
    api.registerHook(
      "agent:before_turn",
      async (event: unknown) => {
        const ev = event as {
          agentId?: string;
          message?: { senderId?: string; channelId?: string };
          context?: Record<string, unknown>;
        };
        if (!ev.context) return;

        const ctx = resolveContext({
          channelId: ev.message?.channelId,
          senderId: ev.message?.senderId,
        });
        if (ctx) {
          (ev.context as Record<string, unknown>).edu = ctx;
        }
      },
    );

    api.logger.info?.(
      "[education-auth] Education auth plugin registered successfully",
    );
  },
});
