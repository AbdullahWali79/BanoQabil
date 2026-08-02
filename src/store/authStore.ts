import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import type { AdminPermissions } from '@/types';

interface AuthState {
  user: User | null;
  role: string | null;
  status: string | null;
  permissions: AdminPermissions | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setRole: (role: string | null) => void;
  setStatus: (status: string | null) => void;
  setPermissions: (permissions: AdminPermissions | null) => void;
  setLoading: (isLoading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  status: null,
  permissions: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setRole: (role) => set({ role }),
  setStatus: (status) => set({ status }),
  setPermissions: (permissions) => set({ permissions }),
  setLoading: (isLoading) => set({ isLoading }),
}));
