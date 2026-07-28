import { Navigate, useLocation } from 'react-router';
import { useAuthStore } from '@/store/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, isLoading } = useAuthStore();
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

  // If user is pending and trying to access anything other than /pending
  if (status === 'Pending' && location.pathname !== '/pending') {
    return <Navigate to="/pending" replace />;
  }

  // If user is approved and trying to access /pending, redirect to dashboard
  if (status !== 'Pending' && location.pathname === '/pending') {
    return <Navigate to="/dashboard" replace />;
  }

  // Wait for role before enforcing role-gated pages (avoids false 403 while resolving)
  if (allowedRoles && !role) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
