import type { AdminPermissions } from '@/types';
import { effectiveAppRole, PRIMARY_ADMIN_EMAIL } from '@/lib/roles';

export type PermissionKey = keyof AdminPermissions;

export const ADMIN_PERMISSION_KEYS: { key: PermissionKey; label: string; hint: string }[] = [
  {
    key: 'can_approve_users',
    label: 'Approve / Reject Users',
    hint: 'Student approvals page',
  },
  {
    key: 'can_manage_teachers',
    label: 'Manage Teachers',
    hint: 'View / create / edit teachers',
  },
  {
    key: 'can_manage_students',
    label: 'Manage Students',
    hint: 'Students list and student fees',
  },
  {
    key: 'can_manage_courses',
    label: 'Manage Courses',
    hint: 'Courses & batches',
  },
  {
    key: 'can_assign_teachers',
    label: 'Assign Teachers to Courses',
    hint: 'Course / class assignment on teachers',
  },
  {
    key: 'can_view_reports',
    label: 'View Reports',
    hint: 'Reports page',
  },
  {
    key: 'can_export_pdf',
    label: 'Export PDF Reports',
    hint: 'Download PDF from Reports / Fees',
  },
  {
    key: 'can_reset_passwords',
    label: 'Reset User Passwords',
    hint: 'Reset student / teacher passwords',
  },
  {
    key: 'can_view_submissions',
    label: 'View All Submissions',
    hint: 'Submission details inside reports',
  },
];

export const ALL_PERMISSIONS_TRUE: AdminPermissions = Object.fromEntries(
  ADMIN_PERMISSION_KEYS.map((p) => [p.key, true]),
) as AdminPermissions;

export function normalizePermissions(
  raw: Record<string, boolean> | AdminPermissions | null | undefined,
): AdminPermissions {
  if (!raw || typeof raw !== 'object') return { ...ALL_PERMISSIONS_TRUE };
  const out: AdminPermissions = {};
  for (const { key } of ADMIN_PERMISSION_KEYS) {
    out[key] = Boolean((raw as Record<string, boolean>)[key]);
  }
  // If nothing was ever set (empty object), grant all for backward compatibility
  const keys = Object.keys(raw);
  if (keys.length === 0) return { ...ALL_PERMISSIONS_TRUE };
  return out;
}

export function countGranted(perms: AdminPermissions | null | undefined) {
  const n = normalizePermissions(perms);
  return ADMIN_PERMISSION_KEYS.filter((p) => Boolean(n[p.key])).length;
}

type PermContext = {
  email?: string | null;
  role?: string | null;
  permissions?: AdminPermissions | null;
};

/** Super Admin always allowed. Admin checked against stored permissions. */
export function can(
  ctx: PermContext,
  key: PermissionKey | PermissionKey[],
): boolean {
  const appRole = effectiveAppRole(ctx.email, ctx.role);
  if (appRole === 'Super Admin') return true;
  if (appRole !== 'Admin') return false;

  // Primary admin email keeps full access unless Super Admin explicitly revoked
  // (still respect saved permissions when present)
  const perms = normalizePermissions(ctx.permissions);
  const keys = Array.isArray(key) ? key : [key];
  return keys.some((k) => Boolean(perms[k]));
}

export function permissionDeniedMessage(key: PermissionKey) {
  const row = ADMIN_PERMISSION_KEYS.find((p) => p.key === key);
  return row
    ? `You do not have permission: ${row.label}. Ask Super Admin to enable it.`
    : 'You do not have permission for this action.';
}

/** Map dashboard path → required permission (Admin only). */
export function permissionForPath(pathname: string): PermissionKey | null {
  if (pathname.startsWith('/dashboard/approvals')) return 'can_approve_users';
  if (pathname.startsWith('/dashboard/teachers')) return 'can_manage_teachers';
  if (pathname.startsWith('/dashboard/students')) return 'can_manage_students';
  if (pathname.startsWith('/dashboard/fees')) return 'can_manage_students';
  if (pathname.startsWith('/dashboard/courses')) return 'can_manage_courses';
  if (pathname.startsWith('/dashboard/reports')) return 'can_view_reports';
  return null;
}

export { PRIMARY_ADMIN_EMAIL };
