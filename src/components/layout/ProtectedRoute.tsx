import { Navigate, useLocation } from 'react-router';
import { useAuthStore } from '@/store/authStore';
import { effectiveAppRole } from '@/lib/roles';
import { can, permissionForPath, type PermissionKey } from '@/lib/permissions';
import type { UnauthorizedReason } from '@/features/auth/pages/UnauthorizedPage';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  /** Admin must have this permission (Super Admin always allowed). */
  requiredPermission?: PermissionKey | PermissionKey[];
}

function toUnauthorized(reason: UnauthorizedReason) {
  return <Navigate to="/unauthorized" replace state={{ reason }} />;
}

export function ProtectedRoute({
  children,
  allowedRoles,
  requiredPermission,
}: ProtectedRouteProps) {
  const { user, role, permissions, isLoading } = useAuthStore();
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

  if (status === 'Pending' && location.pathname !== '/pending') {
    return <Navigate to="/pending" replace />;
  }

  if (status === 'Suspended' && location.pathname !== '/unauthorized') {
    return toUnauthorized('suspended');
  }

  if (status === 'Rejected' && location.pathname !== '/unauthorized') {
    return toUnauthorized('rejected');
  }

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
    return toUnauthorized('role');
  }

  const pathPerm = permissionForPath(location.pathname);
  const need = requiredPermission ?? (appRole === 'Admin' ? pathPerm ?? undefined : undefined);

  if (
    need &&
    appRole === 'Admin' &&
    !can({ email: user.email, role, permissions }, need)
  ) {
    return toUnauthorized('permission');
  }

  return <>{children}</>;
}
