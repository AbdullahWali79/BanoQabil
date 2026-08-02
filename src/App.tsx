import { useEffect } from 'react';
import { AppRoutes } from './routes';
import { supabase } from './lib/supabase';
import { useAuthStore } from './store/authStore';
import { effectiveAppRole } from './lib/roles';
import { normalizePermissions } from './lib/permissions';
import type { User } from '@supabase/supabase-js';
import type { AdminPermissions } from './types';
import { AppToaster } from './components/ui/AppToaster';
import { ConfirmDialogHost } from './components/ui/ConfirmDialogHost';

/**
 * Resolve role without embedding `roles(name)` — that join often 400s when the
 * FK/relationship isn't exposed, which previously left the app with role=null.
 */
async function resolveAuthContext(user: User) {
  const fallbackRole =
    typeof user.user_metadata?.role === 'string' ? user.user_metadata.role : null;

  try {
    const fetchProfileById = await supabase
      .from('profiles')
      .select('id, email, status, role_id, permissions')
      .eq('id', user.id)
      .limit(1);

    let profile = fetchProfileById.data?.[0] ?? null;

    if (!profile && user.email) {
      const fetchProfileByEmail = await supabase
        .from('profiles')
        .select('id, email, status, role_id, permissions')
        .eq('email', user.email)
        .limit(1);
      profile = fetchProfileByEmail.data?.[0] ?? null;
    }

    let resolvedRole: string | null = null;

    if (profile?.role_id) {
      const { data: roleData } = await supabase
        .from('roles')
        .select('name')
        .eq('id', profile.role_id)
        .limit(1);
      resolvedRole = roleData?.[0]?.name ?? null;
    }

    if (!resolvedRole) {
      const profileKey = profile?.id ?? user.id;
      const [{ count: studentCount }, { count: teacherCount }] = await Promise.all([
        supabase
          .from('students')
          .select('id', { head: true, count: 'exact' })
          .eq('profile_id', profileKey),
        supabase
          .from('teachers')
          .select('id', { head: true, count: 'exact' })
          .eq('profile_id', profileKey),
      ]);

      if ((teacherCount ?? 0) > 0) resolvedRole = 'Teacher';
      else if ((studentCount ?? 0) > 0) resolvedRole = 'Student';
    }

    const email =
      user.email ||
      profile?.email ||
      (typeof user.user_metadata?.email === 'string' ? user.user_metadata.email : null);

    const role = effectiveAppRole(email, resolvedRole ?? fallbackRole);
    const status = profile?.status ?? (role ? 'Approved' : null);
    const permissions: AdminPermissions | null =
      role === 'Admin' || role === 'Super Admin'
        ? normalizePermissions(
            (profile?.permissions as Record<string, boolean> | null) ?? null,
          )
        : null;

    return { role, status, permissions };
  } catch {
    const email = user.email ?? null;
    const fallbackRole =
      typeof user.user_metadata?.role === 'string' ? user.user_metadata.role : null;
    const role = effectiveAppRole(email, fallbackRole);
    return {
      role,
      status: role ? 'Approved' : null,
      permissions: role === 'Admin' || role === 'Super Admin' ? normalizePermissions(null) : null,
    };
  }
}

function App() {
  const { setUser, setRole, setStatus, setPermissions, setLoading } = useAuthStore();

  useEffect(() => {
    let mounted = true;

    const applySession = async (session: { user: User } | null) => {
      if (!mounted) return;

      setUser(session?.user ?? null);

      if (session?.user) {
        try {
          const context = await resolveAuthContext(session.user);
          if (!mounted) return;
          // Final guard — never store Super Admin unless designated email
          setRole(effectiveAppRole(session.user.email, context.role));
          setStatus(context.status);
          setPermissions(context.permissions);
        } finally {
          if (mounted) setLoading(false);
        }
      } else {
        setRole(null);
        setStatus(null);
        setPermissions(null);
        setLoading(false);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      void applySession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setLoading(true);
      }
      setTimeout(() => {
        void applySession(session);
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [setUser, setRole, setStatus, setPermissions, setLoading]);

  return (
    <>
      <AppToaster />
      <ConfirmDialogHost />
      <AppRoutes />
    </>
  );
}

export default App;
