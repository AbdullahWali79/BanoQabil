import { useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ArrowLeft, Home, LogIn, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { effectiveAppRole } from '@/lib/roles';

export type UnauthorizedReason =
  | 'permission'
  | 'role'
  | 'suspended'
  | 'rejected'
  | 'unknown';

const COPY: Record<
  UnauthorizedReason,
  { title: string; body: string; tone: string }
> = {
  permission: {
    title: 'Permission required',
    body: 'You do not have access to this page. Ask Super Admin to enable the needed permission, then login again.',
    tone: 'from-amber-500 to-orange-500',
  },
  role: {
    title: 'Wrong account role',
    body: 'This area is not available for your role. Go back to your dashboard or contact Super Admin.',
    tone: 'from-rose-500 to-red-600',
  },
  suspended: {
    title: 'Account suspended',
    body: 'Your account has been suspended. Please contact Super Admin if you think this is a mistake.',
    tone: 'from-slate-700 to-slate-900',
  },
  rejected: {
    title: 'Registration rejected',
    body: 'Your registration was rejected. Contact the institute if you need help or want to re-apply.',
    tone: 'from-rose-600 to-rose-800',
  },
  unknown: {
    title: 'Access denied',
    body: 'You are not authorized to view this page.',
    tone: 'from-rose-500 to-red-600',
  },
};

function resolveReason(
  stateReason: unknown,
  status: string | null,
): UnauthorizedReason {
  if (
    stateReason === 'permission' ||
    stateReason === 'role' ||
    stateReason === 'suspended' ||
    stateReason === 'rejected'
  ) {
    return stateReason;
  }
  if (status === 'Suspended') return 'suspended';
  if (status === 'Rejected') return 'rejected';
  return 'unknown';
}

export default function UnauthorizedPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role, status, setUser, setRole, setStatus, setPermissions } =
    useAuthStore();
  const appRole = effectiveAppRole(user?.email, role);

  const reason = useMemo(
    () =>
      resolveReason(
        (location.state as { reason?: UnauthorizedReason } | null)?.reason,
        status,
      ),
    [location.state, status],
  );

  const copy = COPY[reason];
  const blocked = reason === 'suspended' || reason === 'rejected';

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    setStatus(null);
    setPermissions(null);
    navigate('/login', { replace: true });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(37,99,235,0.08),_transparent_55%)]" />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
        <div className={`h-1.5 w-full bg-gradient-to-r ${copy.tone}`} />

        <div className="space-y-5 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-700 ring-1 ring-rose-100">
              <ShieldOff className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                403 · Unauthorized
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                {copy.title}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{copy.body}</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {user?.email ? (
              <p>
                Signed in as{' '}
                <span className="font-semibold text-slate-900">{user.email}</span>
                {appRole ? (
                  <>
                    {' '}
                    · <span className="font-medium">{appRole}</span>
                  </>
                ) : null}
              </p>
            ) : (
              <p>You are not signed in.</p>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {!blocked && user ? (
              <Button
                className="gap-2 sm:flex-1"
                onClick={() => navigate('/dashboard', { replace: true })}
              >
                <Home className="h-4 w-4" />
                Go to dashboard
              </Button>
            ) : null}

            {!blocked ? (
              <Button
                variant="outline"
                className="gap-2 sm:flex-1"
                onClick={() => {
                  if (window.history.length > 1) navigate(-1);
                  else navigate(user ? '/dashboard' : '/login', { replace: true });
                }}
              >
                <ArrowLeft className="h-4 w-4" />
                Go back
              </Button>
            ) : null}

            {user ? (
              <Button
                variant={blocked ? 'default' : 'outline'}
                className={`gap-2 sm:flex-1 ${blocked ? 'bg-slate-900 text-white hover:bg-slate-800' : ''}`}
                onClick={() => void handleSignOut()}
              >
                <LogIn className="h-4 w-4" />
                Login again
              </Button>
            ) : (
              <Button asChild className="gap-2 sm:flex-1">
                <Link to="/login">
                  <LogIn className="h-4 w-4" />
                  Go to login
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
