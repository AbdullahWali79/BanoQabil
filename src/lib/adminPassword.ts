import { supabase } from '@/lib/supabase';

/**
 * Admin sets/resets another user's password via Edge Function.
 * Requires: supabase functions deploy admin-set-password
 */
export async function adminSetUserPassword(userId: string, password: string) {
  const { data, error } = await supabase.functions.invoke('admin-set-password', {
    body: { userId, password },
  });

  if (error) {
    throw new Error(
      error.message ||
        'Password API unavailable. Deploy edge function admin-set-password, or use Send Reset Email.',
    );
  }

  if (data?.error) {
    throw new Error(String(data.error));
  }

  return data;
}

/** Always-available fallback: email the teacher a reset link */
export async function sendTeacherPasswordResetEmail(email: string) {
  const redirectTo = `${window.location.origin}/login`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw new Error(error.message);
}
