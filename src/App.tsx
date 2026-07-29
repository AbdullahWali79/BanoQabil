import { useEffect } from 'react';
import { AppRoutes } from './routes';
import { supabase } from './lib/supabase';
import { useAuthStore } from './store/authStore';
import { effectiveAppRole } from './lib/roles';
import type { User } from '@supabase/supabase-js';

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
      .select('id, email, status, role_id')
      .eq('id', user.id)
      .limit(1);

    let profile = fetchProfileById.data?.[0] ?? null;

    if (!profile && user.email) {
      const fetchProfileByEmail = await supabase
        .from('profiles')
        .select('id, email, status, role_id')
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

    return { role, status };
  } catch {
    const email = user.email ?? null;
    const fallbackRole =
      typeof user.user_metadata?.role === 'string' ? user.user_metadata.role : null;
    const role = effectiveAppRole(email, fallbackRole);
    return {
      role,
      status: role ? 'Approved' : null,
    };
  }
}

function App() {
  const { setUser, setRole, setStatus, setLoading } = useAuthStore();

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
        } finally {
          if (mounted) setLoading(false);
        }
      } else {
        setRole(null);
        setStatus(null);
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
  }, [setUser, setRole, setStatus, setLoading]);

  return <AppRoutes />;
}

export default App;
