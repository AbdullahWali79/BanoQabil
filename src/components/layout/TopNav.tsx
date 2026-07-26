import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { LogOut, UserCircle } from 'lucide-react';
import { useNavigate } from 'react-router';

export function TopNav() {
  const { user, role } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <header className="h-16 border-b bg-card text-card-foreground sticky top-0 z-50 px-4 md:px-8 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 bg-primary rounded-md flex items-center justify-center text-primary-foreground font-bold">
          BQ
        </div>
        <span className="text-xl font-bold hidden sm:block tracking-tight">BanoQabil</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex flex-col items-end mr-4">
          <span className="text-sm font-semibold">{user?.user_metadata?.full_name || 'User'}</span>
          <span className="text-xs text-muted-foreground px-2 py-0.5 bg-secondary rounded-full mt-1">
            {role}
          </span>
        </div>
        
        <Button variant="ghost" size="icon" className="rounded-full">
          <UserCircle size={24} />
        </Button>
        <Button variant="outline" size="sm" onClick={handleLogout} className="flex items-center gap-2">
          <LogOut size={16} />
          <span className="hidden sm:block">Logout</span>
        </Button>
      </div>
    </header>
  );
}
