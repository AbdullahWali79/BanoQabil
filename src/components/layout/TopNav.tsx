import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { BrandLogo } from '@/components/BrandLogo';
import { useAuthStore } from '@/store/authStore';
import { effectiveAppRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { Bell, ChevronDown, LogOut, Menu, Settings, User } from 'lucide-react';

type TopNavProps = {
  onMenuClick?: () => void;
};

function getInitials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || 'U';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function pageTitleFromPath(pathname: string) {
  const map: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/dashboard/approvals': 'Approvals',
    '/dashboard/teachers': 'Teachers',
    '/dashboard/students': 'Students',
    '/dashboard/courses': 'Courses & Batches',
    '/dashboard/fees': 'Student Fees',
    '/dashboard/reports': 'Reports',
    '/dashboard/admins': 'Admins',
    '/dashboard/staff-pay': 'Staff Pay',
    '/dashboard/staff-reports': 'Staff Reports',
    '/dashboard/roles': 'Roles',
    '/dashboard/settings': 'Settings',
    '/dashboard/my-class': 'My Classes',
    '/dashboard/assignments': 'Assignments',
    '/dashboard/attendance': 'Attendance',
    '/dashboard/notifications': 'Notifications',
    '/dashboard/progress': 'Progress',
    '/dashboard/my-profile': 'My Profile',
    '/dashboard/my-attendance': 'Attendance',
    '/dashboard/my-assignments': 'Assignments',
    '/dashboard/my-submissions': 'Submissions',
    '/dashboard/my-grades': 'Grades',
    '/dashboard/my-notifications': 'Notifications',
  };
  if (map[pathname]) return map[pathname];
  if (pathname.startsWith('/dashboard/assignments/')) return 'Grade Submissions';
  return 'BanoQabil';
}

function bellTarget(appRole: string | null) {
  if (appRole === 'Admin' || appRole === 'Super Admin') {
    return { to: '/dashboard/approvals', label: 'Approvals' };
  }
  if (appRole === 'Teacher') {
    return { to: '/dashboard/assignments', label: 'Assignments' };
  }
  if (appRole === 'Student') {
    return { to: '/dashboard/my-notifications', label: 'Notifications' };
  }
  return { to: '/dashboard', label: 'Notifications' };
}

export function TopNav({ onMenuClick }: TopNavProps) {
  const { user, role } = useAuthStore();
  const appRole = effectiveAppRole(user?.email, role);
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellCount, setBellCount] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const rawName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const displayName =
    String(rawName)
      .replace(/\s*\(super\s*admin\)\s*/gi, '')
      .trim() || 'User';
  const email = user?.email || '';
  const initials = getInitials(displayName, email);
  const pageTitle = pageTitleFromPath(location.pathname);
  const bell = bellTarget(appRole);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadBellCount() {
      try {
        if (appRole === 'Admin' || appRole === 'Super Admin') {
          const { data: roles } = await supabase.from('roles').select('id, name');
          const studentRoleId = roles?.find((r) => r.name === 'Student')?.id;
          const teacherRoleId = roles?.find((r) => r.name === 'Teacher')?.id;
          const roleId = appRole === 'Super Admin' ? teacherRoleId : studentRoleId;
          if (!roleId) {
            if (!cancelled) setBellCount(0);
            return;
          }
          const { count } = await supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'Pending')
            .eq('role_id', roleId);
          if (!cancelled) setBellCount(count ?? 0);
          return;
        }

        if (appRole === 'Student' && user?.id) {
          const { count } = await supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('is_read', false);
          if (!cancelled) setBellCount(count ?? 0);
          return;
        }

        if (appRole === 'Teacher' && user?.id) {
          // Unread-style cue: pending submissions waiting to grade
          const { data: teacher } = await supabase
            .from('teachers')
            .select('id')
            .eq('profile_id', user.id)
            .limit(1);
          const teacherId = teacher?.[0]?.id;
          if (!teacherId) {
            if (!cancelled) setBellCount(0);
            return;
          }
          const { data: assignments } = await supabase
            .from('assignments')
            .select('id')
            .eq('teacher_id', teacherId);
          const ids = (assignments ?? []).map((a) => a.id);
          if (ids.length === 0) {
            if (!cancelled) setBellCount(0);
            return;
          }
          const { count } = await supabase
            .from('submissions')
            .select('id', { count: 'exact', head: true })
            .in('assignment_id', ids)
            .is('marks', null);
          if (!cancelled) setBellCount(count ?? 0);
          return;
        }

        if (!cancelled) setBellCount(0);
      } catch {
        if (!cancelled) setBellCount(0);
      }
    }

    void loadBellCount();
    return () => {
      cancelled = true;
    };
  }, [appRole, user?.id, location.pathname]);

  const handleLogout = async () => {
    setMenuOpen(false);
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <header className="relative z-40 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200/90 bg-white/95 px-4 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-sm sm:px-6">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-blue-600 via-sky-400 to-transparent opacity-80" />

      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 lg:hidden"
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>

        <BrandLogo
          to="/dashboard"
          className="lg:hidden"
          imgClassName="h-8 w-8"
          showText={false}
        />

        <div className="min-w-0">
          <div className="mb-0.5 hidden items-center gap-2 sm:flex">
            <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700">
              {appRole || 'Portal'}
            </span>
          </div>
          <h1 className="truncate text-[15px] font-bold leading-tight tracking-tight text-slate-900 sm:text-base">
            {pageTitle}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <Link
          to={bell.to}
          className="group relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-700 hover:shadow"
          title={bell.label}
          aria-label={bell.label}
        >
          <Bell size={17} className="transition group-hover:scale-105" />
          {bellCount > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gradient-to-b from-rose-500 to-red-600 px-1 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-white">
              {bellCount > 9 ? '9+' : bellCount}
            </span>
          ) : (
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-sky-400 opacity-0 transition group-hover:opacity-100" />
          )}
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 py-1 pl-1 pr-2 shadow-sm transition hover:border-blue-200 hover:shadow sm:pr-3"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 text-[11px] font-bold text-white shadow-sm">
              {initials}
            </span>
            <span className="hidden min-w-0 text-left sm:block">
              <span className="block max-w-[9rem] truncate text-[13px] font-bold leading-tight text-slate-900">
                {displayName}
              </span>
              <span className="block text-[11px] font-medium leading-tight text-slate-500">
                {appRole || 'Account'}
              </span>
            </span>
            <ChevronDown
              size={14}
              className={`hidden text-slate-400 transition-transform sm:block ${
                menuOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60"
            >
              <div className="border-b border-slate-100 bg-gradient-to-br from-blue-50/80 to-white px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-sm font-bold text-white shadow">
                    {initials}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{displayName}</p>
                    <p className="truncate text-xs text-slate-500">{email}</p>
                  </div>
                </div>
                {appRole ? (
                  <span className="mt-3 inline-flex rounded-full bg-blue-600/10 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">
                    {appRole}
                  </span>
                ) : null}
              </div>

              <div className="p-1.5">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate(bell.to);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <Bell size={15} className="text-slate-400" />
                  {bell.label}
                  {bellCount > 0 ? (
                    <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {bellCount > 9 ? '9+' : bellCount}
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/dashboard/settings');
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <Settings size={15} className="text-slate-400" />
                  Settings
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/dashboard/settings');
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <User size={15} className="text-slate-400" />
                  Profile
                </button>
              </div>

              <div className="border-t border-slate-100 p-1.5">
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                >
                  <LogOut size={15} />
                  Logout
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
