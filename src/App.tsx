import { useEffect } from 'react';
import { AppRoutes } from './routes';
import { supabase } from './lib/supabase';
import { useAuthStore } from './store/authStore';
import type { User } from '@supabase/supabase-js';

/** Map DB role names to the labels used by routes / sidebar. */
function normalizeRoleName(role: string | null | undefined): string | null {
  if (!role) return null;
  const normalized = role.trim().toLowerCase();
  // Seed / DB often stores "Admin"; UI + routes use "Super Admin"
  if (
    normalized === 'super admin' ||
    normalized === 'superadmin' ||
    normalized === 'admin'
  ) {
    return 'Super Admin';
  }
  if (normalized === 'teacher') return 'Teacher';
  if (normalized === 'student') return 'Student';
  return role;
}

/**
 * Resolve role without embedding `roles(name)` — that join often 400s when the
 * FK/relationship isn't exposed, which previously left the app with role=null.
 */
async function resolveAuthContext(user: User) {
  const fallbackRole =
    typeof user.user_metadata?.role === 'string' ? user.user_metadata.role : null;

  try {
    // Plain profile select (no nested relation)
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

    // Fallback: infer from membership tables
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

    // Last-resort demo email map (only if DB role still missing)
    if (!resolvedRole && user.email) {
      const email = user.email.toLowerCase();
      if (email === 'teacher123@gmail.com') resolvedRole = 'Teacher';
      else if (email === 'student123@gmail.com') resolvedRole = 'Student';
      else if (email === 'admin123@gmail.com' || email === 'abdullahwali79@gmail.com') {
        resolvedRole = 'Admin';
      }
    }

    const role = normalizeRoleName(resolvedRole ?? fallbackRole);

    // If profile is Approved-or-unknown, don't block; Pending must stay Pending
    const status = profile?.status ?? (role ? 'Approved' : null);

    return { role, status };
  } catch {
    // Never leave the app stuck if metadata / email fallback can help
    const email = user.email?.toLowerCase() ?? '';
    let emergency: string | null = fallbackRole;
    if (!emergency) {
      if (email === 'teacher123@gmail.com') emergency = 'Teacher';
      else if (email === 'student123@gmail.com') emergency = 'Student';
      else if (email === 'admin123@gmail.com') emergency = 'Admin';
    }
    return {
      role: normalizeRoleName(emergency),
      status: emergency ? 'Approved' : null,
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
          setRole(context.role);
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

    // Defer async work — direct awaits inside onAuthStateChange deadlock supabase-js
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
