import { NavLink } from 'react-router';
import { useAuthStore } from '@/store/authStore';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  ClipboardCheck,
  Settings,
  UserCheck,
  BarChart2,
  FileText,
  GraduationCap,
  ChevronRight,
  Shield,
  Layers,
} from 'lucide-react';

type NavItem = {
  to: string;
  icon: React.ReactNode;
  label: string;
};

export function Sidebar() {
  const { role } = useAuthStore();

  const getLinks = (): NavItem[] => {
    const baseLinks: NavItem[] = [
      { to: '/dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
    ];

    if (role === 'Super Admin') {
      baseLinks.push(
        { to: '/dashboard/approvals', icon: <UserCheck size={20} />, label: 'Pending Approvals' },
        { to: '/dashboard/admins', icon: <Shield size={20} />, label: 'Manage Admins' },
        { to: '/dashboard/teachers', icon: <Users size={20} />, label: 'Manage Teachers' },
        { to: '/dashboard/students', icon: <GraduationCap size={20} />, label: 'Manage Students' },
        { to: '/dashboard/courses', icon: <BookOpen size={20} />, label: 'Courses & Batches' },
        { to: '/dashboard/all-assignments', icon: <ClipboardCheck size={20} />, label: 'All Assignments' },
        { to: '/dashboard/all-submissions', icon: <Layers size={20} />, label: 'All Submissions' },
        { to: '/dashboard/reports', icon: <FileText size={20} />, label: 'Reports' },
      );
    }

    if (role === 'Admin') {
      baseLinks.push(
        { to: '/dashboard/approvals', icon: <UserCheck size={20} />, label: 'Pending Approvals' },
        { to: '/dashboard/teachers', icon: <Users size={20} />, label: 'Manage Teachers' },
        { to: '/dashboard/students', icon: <GraduationCap size={20} />, label: 'Manage Students' },
        { to: '/dashboard/courses', icon: <BookOpen size={20} />, label: 'Courses & Batches' },
        { to: '/dashboard/all-assignments', icon: <ClipboardCheck size={20} />, label: 'All Assignments' },
        { to: '/dashboard/all-submissions', icon: <Layers size={20} />, label: 'All Submissions' },
        { to: '/dashboard/reports', icon: <FileText size={20} />, label: 'Reports' },
      );
    }

    if (role === 'Teacher') {
      baseLinks.push(
        { to: '/dashboard/my-class', icon: <Users size={20} />, label: 'My Class' },
        { to: '/dashboard/assignments', icon: <ClipboardCheck size={20} />, label: 'Assignments' },
        { to: '/dashboard/progress', icon: <BarChart2 size={20} />, label: 'Student Progress' },
      );
    }

    if (role === 'Student') {
      baseLinks.push(
        { to: '/dashboard/my-assignments', icon: <ClipboardCheck size={20} />, label: 'My Assignments' },
        { to: '/dashboard/my-grades', icon: <BarChart2 size={20} />, label: 'My Grades' },
      );
    }

    baseLinks.push({ to: '/dashboard/settings', icon: <Settings size={20} />, label: 'Settings' });
    return baseLinks;
  };

  const links = getLinks();

  return (
    <aside className="w-60 min-h-screen bg-card border-r border-border flex flex-col shrink-0 shadow-sm">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <div className="h-9 w-9 bg-gradient-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-md">
          <GraduationCap className="text-white" size={20} />
        </div>
        <span className="text-lg font-bold tracking-tight">BanoQabil</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {role && (
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground px-3 mb-3 font-semibold">
            {role}
          </p>
        )}
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/dashboard'}
            className={({ isActive }) =>
              `group flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`
            }
          >
            <span className="flex items-center gap-3">
              {link.icon}
              {link.label}
            </span>
            <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
