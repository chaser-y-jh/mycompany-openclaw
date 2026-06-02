/**
 * Tenant (school/class) resolver.
 *
 * Ensures strict data isolation between schools in a multi-tenant deployment.
 * All education-table queries are scoped to the caller's school_id.
 */

import type { DatabaseSync } from "node:sqlite";
import type { EduContext } from "./rbac-middleware.js";

/**
 * Tenant-scoped query helper.
 * Wraps a database query to ensure school_id is always in the WHERE clause.
 */
export class TenantScope {
  constructor(
    public readonly db: DatabaseSync,
    public readonly schoolId: string,
  ) {}

  /**
   * Build a SQL WHERE clause fragment that enforces school isolation.
   * Usage: `SELECT * FROM edu_users WHERE ${scope.where("school_id")} AND role = ?`
   */
  where(column: string = "school_id"): string {
    return `${column} = '${this.schoolId.replace(/'/g, "''")}'`;
  }

  /**
   * Verify that a given context belongs to the same school as this scope.
   */
  verifySameSchool(ctx: EduContext): boolean {
    return ctx.school_id === this.schoolId;
  }

  /**
   * Assert same school. Returns the context if valid, null otherwise.
   */
  assertSameSchool(ctx: EduContext | null): EduContext | null {
    if (!ctx) return null;
    return ctx.school_id === this.schoolId ? ctx : null;
  }

  /**
   * Check if a class belongs to this school.
   */
  classBelongsToSchool(classId: string): boolean {
    const row = this.db
      .prepare(
        "SELECT 1 FROM edu_classes WHERE class_id = ? AND school_id = ?",
      )
      .get(classId, this.schoolId);
    return row !== undefined;
  }

  /**
   * Check if a user belongs to this school.
   */
  userBelongsToSchool(userId: string): boolean {
    const row = this.db
      .prepare(
        "SELECT 1 FROM edu_users WHERE user_id = ? AND school_id = ?",
      )
      .get(userId, this.schoolId);
    return row !== undefined;
  }
}

/**
 * Create a tenant scope from configuration.
 */
export function createTenantScope(
  db: DatabaseSync,
  schoolId: string,
): TenantScope {
  return new TenantScope(db, schoolId);
}
