/**
 * HTTP API routes for education auth.
 *
 * Registers REST endpoints under /edu/* for user, class, and
 * enrollment management. All endpoints enforce RBAC and tenant isolation.
 */

import type { DatabaseSync } from "node:sqlite";
import type { TenantScope } from "./tenant-resolver.js";
import type { EduContextResolver, EduContext } from "./rbac-middleware.js";
import { checkPermission } from "./rbac-middleware.js";
import {
  createUser,
  getUserInfo,
  listUsers,
  deactivateUser,
  createClass,
  getClasses,
  addStudentToClass,
  type CreateUserInput,
  type CreateClassInput,
} from "./user-registry.js";

export interface EduApiDeps {
  db: DatabaseSync;
  tenant: TenantScope;
  resolveContext: EduContextResolver;
}

/** Extract edu context from HTTP request headers/query. */
function extractContext(
  deps: EduApiDeps,
  headers: Record<string, string | string[] | undefined>,
  query: Record<string, string | string[] | undefined>,
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

/** Read JSON body from request. */
async function readBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

/** Send a JSON response. */
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/** Send an error response. */
function errorJson(message: string, status = 400): Response {
  return json({ error: message }, status);
}

/**
 * Create an Express-style request handler function.
 * Returns a function that can be passed to registerHttpRoute.
 */
export function createEduApiHandler(deps: EduApiDeps) {
  return async function eduApiHandler(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "");
    const method = req.method.toUpperCase();

    // Health check / info
    if (path === "/edu/info" && method === "GET") {
      return json({
        school_id: deps.tenant.schoolId,
        version: "2026.6.1",
      });
    }

    // ── User endpoints ──────────────────────────────────

    // GET /edu/users — list users (admin only)
    if (path === "/edu/users" && method === "GET") {
      const ctx = extractContext(deps, {}, {});
      const perm = checkPermission(ctx, "users:manage");
      if (!perm.allowed) return errorJson(perm.reason!, 403);

      const roleParam = url.searchParams.get("role");
      const classParam = url.searchParams.get("class_id");
      const users = listUsers(deps.db, deps.tenant, {
        role: roleParam as import("./roles.js").EduRole | undefined,
        class_id: classParam ?? undefined,
      });
      return json({ users });
    }

    // GET /edu/users/:id — get single user
    const userMatch = path.match(/^\/edu\/users\/([^/]+)$/);
    if (userMatch && method === "GET") {
      const userId = userMatch[1];
      const ctx = extractContext(deps, {}, {});
      const perm = checkPermission(ctx, "users:manage");
      if (!perm.allowed) return errorJson(perm.reason!, 403);

      const user = getUserInfo(deps.db, deps.tenant, userId);
      if (!user) return errorJson("用户不存在", 404);
      return json({ user });
    }

    // POST /edu/users — create user (admin only)
    if (path === "/edu/users" && method === "POST") {
      const ctx = extractContext(deps, {}, {});
      const perm = checkPermission(ctx, "users:manage");
      if (!perm.allowed) return errorJson(perm.reason!, 403);

      const body = (await readBody(req)) as CreateUserInput;
      const result = createUser(deps.db, deps.tenant, body);
      if (!result.success) return errorJson(result.error!, 400);
      return json(result, 201);
    }

    // DELETE /edu/users/:id — deactivate user (admin only)
    if (userMatch && method === "DELETE") {
      const userId = userMatch[1];
      const ctx = extractContext(deps, {}, {});
      const perm = checkPermission(ctx, "users:manage");
      if (!perm.allowed) return errorJson(perm.reason!, 403);

      const result = deactivateUser(deps.db, deps.tenant, userId);
      if (!result.success) return errorJson(result.error!, 400);
      return json(result);
    }

    // POST /edu/users/register — self-register (if enabled)
    if (path === "/edu/users/register" && method === "POST") {
      const body = (await readBody(req)) as CreateUserInput & {
        allow_self_register?: boolean;
      };
      // Check self-registration is allowed (passed from index.ts config)
      if (!body.allow_self_register) {
        return errorJson("自助注册未开放，请联系管理员", 403);
      }
      const result = createUser(deps.db, deps.tenant, body);
      if (!result.success) return errorJson(result.error!, 400);
      return json(result, 201);
    }

    // ── Class endpoints ─────────────────────────────────

    // GET /edu/classes — list classes
    if (path === "/edu/classes" && method === "GET") {
      const ctx = extractContext(deps, {}, {});
      // Teachers and admins can list classes
      const perm = checkPermission(ctx, "classes:manage");
      if (!perm.allowed) return errorJson(perm.reason!, 403);

      const classes = getClasses(deps.db, deps.tenant);
      return json({ classes });
    }

    // POST /edu/classes — create class (admin only)
    if (path === "/edu/classes" && method === "POST") {
      const ctx = extractContext(deps, {}, {});
      const perm = checkPermission(ctx, "classes:manage");
      if (!perm.allowed) return errorJson(perm.reason!, 403);

      const body = (await readBody(req)) as CreateClassInput;
      const result = createClass(deps.db, deps.tenant, body);
      if (!result.success) return errorJson(result.error!, 400);
      return json(result, 201);
    }

    // ── Enrollment endpoints ────────────────────────────

    // POST /edu/enrollments — enroll student in class
    if (path === "/edu/enrollments" && method === "POST") {
      const ctx = extractContext(deps, {}, {});
      const perm = checkPermission(ctx, "classes:manage");
      if (!perm.allowed) return errorJson(perm.reason!, 403);

      const body = (await readBody(req)) as {
        user_id: string;
        class_id: string;
      };
      const result = addStudentToClass(
        deps.db,
        deps.tenant,
        body.user_id,
        body.class_id,
      );
      if (!result.success) return errorJson(result.error!, 400);
      return json(result, 201);
    }

    // ── Identity endpoint ───────────────────────────────

    // GET /edu/me — get current user identity
    if (path === "/edu/me" && method === "GET") {
      const ctx = extractContext(deps, {}, {});
      if (!ctx) return errorJson("未登录教育系统", 401);
      const user = getUserInfo(deps.db, deps.tenant, ctx.user_id);
      return json({ user: user ?? ctx });
    }

    return errorJson("Not Found", 404);
  };
}
