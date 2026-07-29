import { NavLink } from 'react-router';
import { useAuthStore } from '@/store/authStore';
import { effectiveAppRole } from '@/lib/roles';
import {
  LayoutDashboard,
  Shield,
  Users,
  BookOpen,
  ClipboardCheck,
  Settings,
  UserCheck,
  BarChart2,
  FileText,
  GraduationCap,
  Upload,
  CalendarCheck,
  Bell,
  KeyRound,
  X,
  Banknote,
  Receipt,
} from 'lucide-react';

type NavItem = {
  to: string;
  icon: React.ReactNode;
  label: string;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

type SidebarProps = {
  mobileOpen?: boolean;
  onClose?: () => void;
};

function buildGroups(appRole: string | null): NavGroup[] {
  const groups: NavGroup[] = [
    {
      title: 'Overview',
      items: [{ to: '/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' }],
    },
  ];

  if (appRole === 'Super Admin') {
    groups.push({
      title: 'Platform',
      items: [
        { to: '/dashboard/approvals', icon: <UserCheck size={18} />, label: 'Approvals' },
        { to: '/dashboard/teachers', icon: <Users size={18} />, label: 'Teachers' },
        { to: '/dashboard/admins', icon: <Shield size={18} />, label: 'Admins' },
        { to: '/dashboard/staff-pay', icon: <Banknote size={18} />, label: 'Staff Pay' },
        { to: '/dashboard/roles', icon: <KeyRound size={18} />, label: 'Roles' },
      ],
    });
  }

  if (appRole === 'Admin') {
    groups.push(
      {
        title: 'People',
        items: [
          { to: '/dashboard/approvals', icon: <UserCheck size={18} />, label: 'Approvals' },
          { to: '/dashboard/teachers', icon: <Users size={18} />, label: 'Teachers' },
          { to: '/dashboard/students', icon: <GraduationCap size={18} />, label: 'Students' },
        ],
      },
      {
        title: 'Academics',
        items: [
          { to: '/dashboard/courses', icon: <BookOpen size={18} />, label: 'Courses & Batches' },
          { to: '/dashboard/fees', icon: <Receipt size={18} />, label: 'Student Fees' },
          { to: '/dashboard/reports', icon: <FileText size={18} />, label: 'Reports' },
        ],
      },
    );
  }

  if (appRole === 'Teacher') {
    groups.push({
      title: 'Classroom',
      items: [
        { to: '/dashboard/my-class', icon: <Users size={18} />, label: 'My Classes' },
        { to: '/dashboard/assignments', icon: <ClipboardCheck size={18} />, label: 'Assignments' },
        { to: '/dashboard/attendance', icon: <CalendarCheck size={18} />, label: 'Attendance' },
        { to: '/dashboard/notifications', icon: <Bell size={18} />, label: 'Notifications' },
        { to: '/dashboard/progress', icon: <BarChart2 size={18} />, label: 'Progress' },
      ],
    });
  }

  if (appRole === 'Student') {
    groups.push({
      title: 'My Learning',
      items: [
        { to: '/dashboard/my-profile', icon: <Users size={18} />, label: 'My Profile' },
        { to: '/dashboard/my-attendance', icon: <CalendarCheck size={18} />, label: 'Attendance' },
        { to: '/dashboard/my-assignments', icon: <ClipboardCheck size={18} />, label: 'Assignments' },
        { to: '/dashboard/my-submissions', icon: <Upload size={18} />, label: 'Submissions' },
        { to: '/dashboard/my-grades', icon: <GraduationCap size={18} />, label: 'Grades' },
        { to: '/dashboard/my-notifications', icon: <Bell size={18} />, label: 'Notifications' },
      ],
    });
  }

  groups.push({
    title: 'Account',
    items: [{ to: '/dashboard/settings', icon: <Settings size={18} />, label: 'Settings' }],
  });

  return groups;
}

function SidebarPanel({
  appRole,
  displayName,
  email,
  groups,
  onClose,
  showClose,
}: {
  appRole: string | null;
  displayName: string;
  email?: string | null;
  groups: NavGroup[];
  onClose?: () => void;
  showClose?: boolean;
}) {
  const initials =
    displayName
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || '')
      .join('') || 'BQ';

  return (
    <div className="flex h-full flex-col bg-white text-slate-800">
      {/* Logo */}
      <div className="flex h-[72px] shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-4">
        <NavLink
          to="/dashboard"
          onClick={onClose}
          className="flex min-w-0 items-center gap-3"
        >
          <img
            src="/banoqabil_logo.png"
            alt="BanoQabil"
            className="h-10 w-10 shrink-0 object-contain"
          />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[17px] font-bold tracking-tight text-slate-900">
              BanoQabil
            </p>
            <p className="truncate text-[11px] font-medium text-slate-500">
              {appRole || 'LMS Portal'}
            </p>
          </div>
        </NavLink>
        {showClose ? (
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        ) : null}
      </div>

      {/* Links — scrollbar hidden */}
      <nav className="sidebar-nav-scroll flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((link) => (
                <li key={link.to}>
                  <NavLink
                    to={link.to}
                    end={link.to === '/dashboard'}
                    onClick={onClose}
                    className={({ isActive }) =>
                      [
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors',
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                      ].join(' ')
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={
                            isActive ? 'text-white' : 'text-slate-400'
                          }
                        >
                          {link.icon}
                        </span>
                        <span className="truncate">{link.label}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="shrink-0 border-t border-slate-100 p-3">
        <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-2.5 py-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
            <p className="truncate text-[11px] text-slate-500">{email || 'Signed in'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const { role, user } = useAuthStore();
  const appRole = effectiveAppRole(user?.email, role);
  const groups = buildGroups(appRole);
  const rawName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const displayName =
    String(rawName)
      .replace(/\s*\(super\s*admin\)\s*/gi, '')
      .trim() || 'User';

  return (
    <>
      <aside className="hidden h-screen w-64 shrink-0 overflow-hidden border-r border-slate-200 bg-white lg:block">
        <SidebarPanel
          appRole={appRole}
          displayName={displayName}
          email={user?.email}
          groups={groups}
        />
      </aside>

      <div
        className={[
          'fixed inset-0 z-[60] lg:hidden',
          mobileOpen ? 'pointer-events-auto' : 'pointer-events-none',
        ].join(' ')}
        aria-hidden={!mobileOpen}
      >
        <button
          type="button"
          className={[
            'absolute inset-0 bg-black/40 transition-opacity',
            mobileOpen ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
          onClick={onClose}
          aria-label="Close sidebar overlay"
        />
        <aside
          className={[
            'absolute inset-y-0 left-0 w-64 max-w-[88vw] bg-white shadow-xl transition-transform duration-200 ease-out',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          ].join(' ')}
        >
          <SidebarPanel
            appRole={appRole}
            displayName={displayName}
            email={user?.email}
            groups={groups}
            onClose={onClose}
            showClose
          />
        </aside>
      </div>
    </>
  );
}
