/**
 * 邮箱配置状态管理
 */

import { create } from 'zustand';
import { EmailConfig, Email } from '@/lib/api';

interface EmailState {
  // State
  configs: EmailConfig[];
  activeConfig: EmailConfig | null;
  emails: Email[];
  selectedEmail: Email | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setConfigs: (configs: EmailConfig[]) => void;
  setActiveConfig: (config: EmailConfig | null) => void;
  addConfig: (config: EmailConfig) => void;
  updateConfig: (id: string, config: Partial<EmailConfig>) => void;
  removeConfig: (id: string) => void;
  setEmails: (emails: Email[]) => void;
  setSelectedEmail: (email: Email | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useEmailStore = create<EmailState>((set) => ({
  // Initial State
  configs: [],
  activeConfig: null,
  emails: [],
  selectedEmail: null,
  isLoading: false,
  error: null,

  // Actions
  setConfigs: (configs) => set({ configs }),
  setActiveConfig: (config) => set({ activeConfig: config }),
  addConfig: (config) =>
    set((state) => ({
      configs: [...state.configs, config],
      activeConfig: config,
    })),
  updateConfig: (id, config) =>
    set((state) => ({
      configs: state.configs.map((c) => (c.id === id ? { ...c, ...config } : c)),
      activeConfig: state.activeConfig?.id === id ? { ...state.activeConfig, ...config } : state.activeConfig,
    })),
  removeConfig: (id) =>
    set((state) => ({
      configs: state.configs.filter((c) => c.id !== id),
      activeConfig: state.activeConfig?.id === id ? null : state.activeConfig,
    })),
  setEmails: (emails) => set({ emails }),
  setSelectedEmail: (email) => set({ selectedEmail: email }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}));

export default useEmailStore;
