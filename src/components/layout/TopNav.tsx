import { useEffect, useRef, useState } from 'react';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { ChevronDown, LogOut, User } from 'lucide-react';
import { useNavigate } from 'react-router';

function getInitials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || 'U';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function TopNav() {
  const { user, role } = useAuthStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const displayName =
    user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const email = user?.email || '';
  const initials = getInitials(user?.user_metadata?.full_name, email);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
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

  const handleLogout = async () => {
    setMenuOpen(false);
    await supabase.auth.signOut();
    navigate('/login');
  };

  const goToProfile = () => {
    setMenuOpen(false);
    navigate('/dashboard/settings');
  };

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-border/80 bg-card/95 px-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 md:px-8">
      <BrandLogo
        to="/dashboard"
        imgClassName="h-9 md:h-10"
        textClassName="hidden sm:block text-lg"
      />

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="flex items-center gap-2.5 rounded-full border border-border bg-background py-1.5 pl-1.5 pr-2.5 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:pr-3"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-sm">
            {initials}
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block max-w-[10rem] truncate text-sm font-semibold leading-tight">
              {displayName}
            </span>
            <span className="block text-[11px] font-medium text-muted-foreground">
              {role || 'Account'}
            </span>
          </span>
          <ChevronDown
            size={16}
            className={`hidden text-muted-foreground transition-transform sm:block ${menuOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {menuOpen ? (
          <div
            role="menu"
            className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-card shadow-lg ring-1 ring-black/5"
          >
            <div className="border-b border-border bg-muted/40 px-4 py-3">
              <p className="truncate text-sm font-semibold">{displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
              {role ? (
                <span className="mt-2 inline-flex rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  {role}
                </span>
              ) : null}
            </div>

            <div className="p-1.5">
              <button
                type="button"
                role="menuitem"
                onClick={goToProfile}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <User size={16} className="text-muted-foreground" />
                Profile & Settings
              </button>
            </div>

            <div className="border-t border-border p-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="h-auto w-full justify-start gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut size={16} />
                Logout
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
