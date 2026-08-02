/**
 * Secure, human-friendly error messages.
 * Never surfaces raw Postgres/SQL/JWT/stack internals to users.
 * Developers: check console for the original error when needed.
 */

const SENSITIVE =
  /(jwt|bearer|apikey|api[_-]?key|secret|password|authorization|service[_-]?role|postgres|stack|at\s+\S+\(|supabase\.co\/storage)/i;

function extractRaw(err: unknown): { message: string; code: string; status?: number } {
  if (err == null) return { message: '', code: '' };
  if (typeof err === 'string') return { message: err, code: '' };
  if (typeof err !== 'object') return { message: String(err), code: '' };

  const o = err as Record<string, unknown>;
  const message = String(o.message ?? o.error_description ?? o.error ?? '').trim();
  const code = String(o.code ?? o.error_code ?? '').trim();
  const status = typeof o.status === 'number' ? o.status : undefined;
  return { message, code, status };
}

function looksInternal(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    SENSITIVE.test(msg) ||
    lower.includes('permission denied for') ||
    lower.includes('violates check constraint') ||
    lower.includes('violates foreign key') ||
    lower.includes('null value in column') ||
    (lower.includes('column') && lower.includes('does not exist')) ||
    (lower.includes('relation') && lower.includes('does not exist')) ||
    lower.includes('syntax error') ||
    lower.includes('pgrst') ||
    /^[A-Z0-9]{5}$/.test(msg)
  );
}

/** Map any thrown / Supabase error to a short, safe user-facing string. */
export function formatAppError(err: unknown, fallback = 'Something went wrong.'): string {
  const { message, code, status } = extractRaw(err);
  const raw = message || fallback;
  const lower = raw.toLowerCase();

  if (import.meta.env.DEV && err) {
    console.warn('[appError]', err);
  }

  if (
    code === 'invalid_credentials' ||
    lower.includes('invalid login credentials') ||
    lower.includes('invalid email or password')
  ) {
    return 'Wrong email or password.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Confirm your email first.';
  }
  if (lower.includes('user already registered') || lower.includes('already been registered')) {
    return 'Email already registered.';
  }
  if (lower.includes('too many requests') || lower.includes('rate limit') || status === 429) {
    return 'Too many attempts. Wait a bit.';
  }
  if (lower.includes('session') && (lower.includes('expired') || lower.includes('not logged'))) {
    return 'Session expired. Sign in again.';
  }
  if (lower.includes('you are not logged in')) {
    return 'Please sign in again.';
  }

  if (
    code === '42501' ||
    lower.includes('row-level security') ||
    lower.includes('violates row-level security') ||
    lower.includes('permission denied') ||
    status === 401 ||
    status === 403
  ) {
    return "You don't have permission.";
  }

  if (lower.includes('more than one row returned by a subquery')) {
    return 'System setup issue. Contact admin.';
  }

  if (code === '23505' || lower.includes('duplicate') || lower.includes('unique constraint')) {
    if (lower.includes('email') || lower.includes('users_email')) return 'Email already in use.';
    if (lower.includes('username')) return 'Username already taken.';
    if (lower.includes('cnic')) return 'CNIC already registered.';
    if (lower.includes('application_id')) return 'Application ID already used.';
    return 'This value already exists.';
  }

  if (code === '23503' || lower.includes('foreign key')) {
    return 'Related data missing. Refresh and retry.';
  }

  if (code === 'PGRST116' || lower.includes('not found') || status === 404) {
    if (lower.includes('edge function') || lower.includes('admin-set-password')) {
      return 'Password service unavailable.';
    }
    return 'Item not found.';
  }

  if (
    lower.includes('failed to send a request to the edge function') ||
    lower.includes('cannot reach edge function') ||
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network error')
  ) {
    return 'Network error. Try again.';
  }
  if (lower.includes('edge function') || lower.includes('password api')) {
    return 'Password update failed.';
  }

  if (
    lower.includes('required') ||
    lower.includes('must be') ||
    lower.includes('invalid') ||
    lower.includes('do not match') ||
    lower.includes('at least') ||
    lower.includes('only super admin') ||
    lower.includes('only admin')
  ) {
    if (SENSITIVE.test(raw) || looksInternal(raw)) return fallback;
    return raw.length > 72 ? `${raw.slice(0, 71).trimEnd()}…` : raw;
  }

  if (lower.startsWith('conflict:') || lower.includes('overlapping')) {
    return raw.replace(/^conflict:\s*/i, '').slice(0, 72) || fallback;
  }

  if (!message || looksInternal(raw) || raw.length > 120) {
    return fallback;
  }

  if (/^[A-Za-z0-9][\w\s.',\-:/()]{3,71}$/.test(raw) && !looksInternal(raw)) {
    return raw;
  }

  return fallback;
}

/** @deprecated Prefer formatAppError — kept for existing imports. */
export const formatSupabaseError = formatAppError;
