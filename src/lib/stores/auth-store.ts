// 开源版：认证存储 stub（本地单用户模式）
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const LOCAL_USER = {
  id: 'local',
  email: 'local@postwizard.local',
  name: 'Local User',
  isPaidUser: true,
  plan: 'FREE' as const,
  freeQuota: 9999,
  freeUsedCount: 0,
  expiryDate: null,
};

interface AuthState {
  token: string;
  user: typeof LOCAL_USER;
  login: () => void;
  logout: () => void;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: 'local-token',
      user: LOCAL_USER,
      login: () => {},
      logout: () => {},
      fetchUser: async () => {},
    }),
    {
      name: 'auth-storage',
    }
  )
);
