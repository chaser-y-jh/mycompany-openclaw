/**
 * Education role definitions and permission matrix.
 *
 * Roles: student, teacher, parent, admin
 * Each role has a set of allowed actions scoped by tenant (school/class).
 */

export type EduRole = "student" | "teacher" | "parent" | "admin";

export type EduPermission =
  | "chat:tutor" // Can chat with tutoring agent
  | "chat:teacher" // Can chat with teacher assistant agent
  | "homework:submit" // Can submit homework
  | "homework:view_own" // Can view own homework/submissions
  | "homework:grade" // Can grade submissions
  | "homework:create" // Can create assignments
  | "homework:view_class" // Can view all submissions for a class
  | "progress:view_own" // Can view own progress reports
  | "progress:view_class" // Can view class-wide progress
  | "progress:view_child" // Can view linked child's progress
  | "lesson:create" // Can create lesson plans
  | "quiz:create" // Can create quizzes
  | "quiz:take" // Can take quizzes
  | "attendance:record" // Can record attendance (roll call)
  | "attendance:view_own" // Can view own attendance
  | "attendance:view_class" // Can view class-wide attendance
  | "users:manage" // Can create/edit/delete users
  | "classes:manage" // Can create/edit/delete classes
  | "school:manage" // Can manage school settings
  | "system:config"; // Can change system configuration

/** Permission matrix: which roles have which permissions. */
export const ROLE_PERMISSIONS: Record<EduRole, Set<EduPermission>> = {
  student: new Set<EduPermission>([
    "chat:tutor",
    "homework:submit",
    "homework:view_own",
    "progress:view_own",
    "quiz:take",
    "attendance:view_own",
  ]),
  teacher: new Set<EduPermission>([
    "chat:teacher",
    "homework:grade",
    "homework:create",
    "homework:view_class",
    "progress:view_class",
    "lesson:create",
    "quiz:create",
    "attendance:record",
    "attendance:view_own",
    "attendance:view_class",
  ]),
  parent: new Set<EduPermission>([
    "progress:view_child",
    "homework:view_own", // view linked child's homework
    "attendance:view_own", // view linked child's attendance
  ]),
  admin: new Set<EduPermission>([
    "chat:tutor",
    "chat:teacher",
    "homework:submit",
    "homework:view_own",
    "homework:grade",
    "homework:create",
    "homework:view_class",
    "progress:view_own",
    "progress:view_class",
    "progress:view_child",
    "lesson:create",
    "quiz:create",
    "quiz:take",
    "attendance:record",
    "attendance:view_own",
    "attendance:view_class",
    "users:manage",
    "classes:manage",
    "school:manage",
    "system:config",
  ]),
};

/** Human-readable labels for each role. */
export const ROLE_LABELS: Record<EduRole, string> = {
  student: "学生",
  teacher: "教师",
  parent: "家长",
  admin: "管理员",
};

/** All education roles as an ordered array (for UI display). */
export const ALL_ROLES: EduRole[] = ["student", "teacher", "parent", "admin"];

/**
 * Check if a role has a specific permission.
 */
export function roleHasPermission(
  role: EduRole,
  permission: EduPermission,
): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

/**
 * Get all permissions for a given role.
 */
export function getRolePermissions(role: EduRole): ReadonlySet<EduPermission> {
  return ROLE_PERMISSIONS[role] ?? new Set();
}

/**
 * Validate that a role string is a known education role.
 */
export function isValidRole(value: string): value is EduRole {
  return ALL_ROLES.includes(value as EduRole);
}
