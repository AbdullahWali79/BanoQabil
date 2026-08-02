import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { KeyRound, LogIn } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { effectiveAppRole } from '@/lib/roles';
import { normalizePermissions } from '@/lib/permissions';
import type { AdminPermissions } from '@/types';
import { Button } from '@/components/ui/button';

function fingerprint(perms: AdminPermissions | null | undefined, status: string | null) {
  return `${status || ''}|${JSON.stringify(normalizePermissions(perms))}`;
}

/**
 * When Super Admin changes an Admin's permissions/status while they are logged in,
 * show a blocking "Please login again" dialog and force sign-out.
 */
export function AccessChangeGuard() {
  const navigate = useNavigate();
  const { user, role, status, permissions, setPermissions, setStatus } = useAuthStore();
  const appRole = effectiveAppRole(user?.email, role);
  const [prompt, setPrompt] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const baselineRef = useRef<string | null>(null);
  const promptedRef = useRef(false);

  // Keep baseline in sync while no prompt is showing
  useEffect(() => {
    if (prompt || promptedRef.current) return;
    if (appRole !== 'Admin' || !user?.id) {
      baselineRef.current = null;
      return;
    }
    baselineRef.current = fingerprint(permissions, status);
  }, [appRole, user?.id, permissions, status, prompt]);

  useEffect(() => {
    if (appRole !== 'Admin' || !user?.id) return;

    const profileId = user.id;

    const checkRemote = async () => {
      if (promptedRef.current) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('status, permissions')
        .eq('id', profileId)
        .maybeSingle();
      if (error || !data) return;

      const remotePerms = normalizePermissions(
        (data.permissions as Record<string, boolean> | null) ?? null,
      );
      const remoteFp = fingerprint(remotePerms, data.status ?? null);
      const localFp = baselineRef.current ?? fingerprint(permissions, status);

      if (remoteFp !== localFp) {
        promptedRef.current = true;
        setPermissions(remotePerms);
        setStatus(data.status ?? null);
        setPrompt(true);
      }
    };

    // Realtime: own profile row updates
    const channel = supabase
      .channel(`access-guard-${profileId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${profileId}`,
        },
        () => {
          void checkRemote();
        },
      )
      .subscribe();

    const onFocus = () => void checkRemote();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void checkRemote();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);

    // Light poll as fallback if realtime is off
    const interval = window.setInterval(() => void checkRemote(), 45_000);

    return () => {
      void supabase.removeChannel(channel);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(interval);
    };
  }, [appRole, user?.id, permissions, status, setPermissions, setStatus]);

  const handleLoginAgain = async () => {
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
      useAuthStore.getState().setUser(null);
      useAuthStore.getState().setRole(null);
      useAuthStore.getState().setStatus(null);
      useAuthStore.getState().setPermissions(null);
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
      setPrompt(false);
    }
  };

  if (!prompt) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[3px]"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="access-change-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 to-orange-500" />
        <div className="space-y-4 p-6">
          <div className="flex gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-200">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Access updated
              </p>
              <h2 id="access-change-title" className="mt-1 text-lg font-bold text-slate-900">
                Please login again
              </h2>
            </div>
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-sm leading-relaxed text-slate-700">
            Your admin permissions or account status were changed by Super Admin. Sign in again to
            continue with the updated access.
          </div>

          <Button
            className="h-11 w-full gap-2 bg-amber-600 text-white hover:bg-amber-700"
            disabled={loggingOut}
            onClick={() => void handleLoginAgain()}
          >
            {loggingOut ? (
              <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            {loggingOut ? 'Signing out…' : 'Login again'}
          </Button>
        </div>
      </div>
    </div>
  );
}
