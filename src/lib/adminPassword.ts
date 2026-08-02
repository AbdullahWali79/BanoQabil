import { supabase } from '@/lib/supabase';

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

type AdminSetBody = {
  userId: string;
  password?: string;
  email?: string;
};

/**
 * Call Edge Function with explicit JWT (more reliable than functions.invoke).
 * Requires: supabase functions deploy admin-set-password
 */
async function callAdminSetPassword(body: AdminSetBody) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    throw new Error('You are not logged in. Please log in again and retry.');
  }

  if (!import.meta.env.VITE_SUPABASE_URL || !ANON_KEY) {
    throw new Error('Supabase URL/key missing in app env (VITE_SUPABASE_URL).');
  }

  let res: Response;
  try {
    res = await fetch(`${FUNCTIONS_BASE}/admin-set-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: ANON_KEY,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(
      'Cannot reach Edge Function. In Supabase Dashboard → Edge Functions, deploy "admin-set-password" (Vercel deploy is not enough).',
    );
  }

  let payload: { error?: string; ok?: boolean } | null = null;
  const text = await res.text();
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        'Edge Function "admin-set-password" not found. Deploy it in Supabase → Edge Functions.',
      );
    }
    throw new Error(
      payload?.error || `Password API failed (${res.status}). ${text.slice(0, 180)}`,
    );
  }

  if (payload?.error) {
    throw new Error(String(payload.error));
  }

  return payload;
}

/** Admin sets/resets another user's password via Edge Function. */
export async function adminSetUserPassword(userId: string, password: string) {
  return callAdminSetPassword({ userId, password });
}

/** Admin updates another user's login email (Auth + profiles). */
export async function adminSetUserEmail(userId: string, email: string) {
  return callAdminSetPassword({ userId, email });
}

/** Always-available fallback: email the user a reset link */
export async function sendTeacherPasswordResetEmail(email: string) {
  const redirectTo = `${window.location.origin}/login`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw new Error(error.message);
}
