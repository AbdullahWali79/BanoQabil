import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';

export function AppLayout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-screen max-h-screen overflow-hidden bg-background text-foreground">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-50">
        <TopNav onMenuClick={() => setMobileOpen(true)} />
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-auto p-3 sm:p-5 lg:p-6">
          <div className="mx-auto w-full max-w-6xl min-w-0">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
