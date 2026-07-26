import { NavLink } from 'react-router';
import { useAuthStore } from '@/store/authStore';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  ClipboardCheck, 
  Settings,
  UserCheck
} from 'lucide-react';

export function Sidebar() {
  const { role } = useAuthStore();

  const getLinks = () => {
    const baseLinks = [
      { to: '/', icon: <LayoutDashboard size={20} />, label: 'Dashboard' }
    ];

    if (role === 'Super Admin' || role === 'Admin') {
      baseLinks.push(
        { to: '/approvals', icon: <UserCheck size={20} />, label: 'Pending Approvals' },
        { to: '/users', icon: <Users size={20} />, label: 'Manage Users' },
        { to: '/courses', icon: <BookOpen size={20} />, label: 'Courses & Batches' }
      );
    }

    if (role === 'Teacher') {
      baseLinks.push(
        { to: '/my-classes', icon: <Users size={20} />, label: 'My Classes' },
        { to: '/assignments', icon: <BookOpen size={20} />, label: 'Assignments' },
        { to: '/attendance', icon: <ClipboardCheck size={20} />, label: 'Attendance' }
      );
    }

    if (role === 'Student') {
      baseLinks.push(
        { to: '/my-assignments', icon: <BookOpen size={20} />, label: 'My Assignments' },
        { to: '/my-attendance', icon: <ClipboardCheck size={20} />, label: 'My Attendance' }
      );
    }

    baseLinks.push({ to: '/settings', icon: <Settings size={20} />, label: 'Settings' });

    return baseLinks;
  };

  const links = getLinks();

  return (
    <aside className="w-64 border-r bg-card hidden md:flex flex-col h-[calc(100vh-4rem)] sticky top-16">
      <div className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                isActive 
                  ? 'bg-primary text-primary-foreground font-medium shadow-md' 
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`
            }
          >
            {link.icon}
            {link.label}
          </NavLink>
        ))}
      </div>
    </aside>
  );
}
