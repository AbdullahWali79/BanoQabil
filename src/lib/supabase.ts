import { createClient } from '@supabase/supabase-js';

// Default to placeholder values if env vars are missing to prevent crash on startup
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Temporary auth client that does NOT touch the logged-in admin session.
 * Use for admin-created accounts (signUp) so the admin stays logged in.
 */
export function createEphemeralAuthClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `bq-ephemeral-${Math.random().toString(36).slice(2)}`,
    },
  });
}
