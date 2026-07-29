/** Only this email may use the Super Admin panel. */
export const SUPER_ADMIN_EMAIL = 'superadmin@gmail.com';

/** Real operational Admin (not a demo account). */
export const PRIMARY_ADMIN_EMAIL = 'abdullahwali79@gmail.com';

/**
 * Map DB / metadata role to the role the UI should use.
 * Super Admin UI is locked to SUPER_ADMIN_EMAIL only.
 */
export function effectiveAppRole(
  email: string | null | undefined,
  role: string | null | undefined,
): string | null {
  const e = (email || '').trim().toLowerCase();
  const r = (role || '').trim();
  if (!e && !r) return null;

  if (e === SUPER_ADMIN_EMAIL) return 'Super Admin';
  if (e === PRIMARY_ADMIN_EMAIL) return 'Admin';

  const lower = r.toLowerCase();
  if (lower === 'super admin' || lower === 'superadmin') {
    // Never give Super Admin panel to anyone except the designated email
    return 'Admin';
  }
  if (lower === 'admin') return 'Admin';
  if (lower === 'teacher') return 'Teacher';
  if (lower === 'student') return 'Student';

  return r || null;
}
