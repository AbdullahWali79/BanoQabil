import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router';
import { Clock, LogOut, Mail } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

export function PendingApprovalPage() {
  const navigate = useNavigate();
  const { user, setUser, setRole, setStatus, setPermissions } = useAuthStore();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    setStatus(null);
    setPermissions(null);
    navigate('/login', { replace: true });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(234,179,8,0.12),_transparent_55%)]" />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 to-yellow-500" />
        <div className="space-y-5 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Approval pending
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Your account is under review. You will get dashboard access once an administrator
              approves you.
            </p>
          </div>
          {user?.email ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <Mail className="h-4 w-4 shrink-0" />
              <span className="truncate font-medium text-slate-900">{user.email}</span>
            </div>
          ) : null}
          <Button variant="outline" className="w-full gap-2" onClick={() => void handleLogout()}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
