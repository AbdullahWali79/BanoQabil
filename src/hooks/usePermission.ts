import { useAuthStore } from '@/store/authStore';
import { can, permissionDeniedMessage, type PermissionKey } from '@/lib/permissions';

export function usePermission() {
  const { user, role, permissions } = useAuthStore();
  const ctx = { email: user?.email, role, permissions };

  return {
    can: (key: PermissionKey | PermissionKey[]) => can(ctx, key),
    denyMessage: permissionDeniedMessage,
    ctx,
  };
}
