import { Navigate, useLocation } from 'react-router';
import { useAuthStore } from '@/store/authStore';
import { effectiveAppRole } from '@/lib/roles';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, isLoading } = useAuthStore();
  const appRole = effectiveAppRole(user?.email, role);
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const { status } = useAuthStore.getState();

  // Account gating by status
  if (status === 'Pending' && location.pathname !== '/pending') {
    return <Navigate to="/pending" replace />;
  }

  // Suspended / Rejected accounts should never access dashboards
  if ((status === 'Suspended' || status === 'Rejected') && location.pathname !== '/unauthorized') {
    return <Navigate to="/unauthorized" replace />;
  }

  // If approved accounts try to access /pending, redirect to dashboard
  if (status !== 'Pending' && location.pathname === '/pending') {
    return <Navigate to="/dashboard" replace />;
  }

  if (allowedRoles && !appRole) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (allowedRoles && appRole && !allowedRoles.includes(appRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
