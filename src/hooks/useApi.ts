/**
 * API React Hooks 封装
 * 使用 React Query 进行数据获取和状态管理
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, EmailConfig, Email, Recipient, GeneratedContent } from '@/lib/api';
import { apiFetch } from '@/lib/fetch';

// Email Config Hooks
export function useEmailConfigs() {
  return useQuery({
    queryKey: ['emailConfigs'],
    queryFn: async () => {
      const result = await api.getEmailConfigs();
      // API 返回 { configs: [...] } 格式
      if (result.configs) {
        return result.configs;
      }
      if (!result.success) throw new Error(result.error);
      return result.data || [];
    },
  });
}

export function useCreateEmailConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: Omit<EmailConfig, 'id'>) => {
      const result = await api.createEmailConfig(config);
      if (!result.success) throw new Error(result.error || '创建失败');
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailConfigs'] });
    },
  });
}

export function useTestEmailConfig() {
  return useMutation({
    mutationFn: (id: string) => api.testEmailConfig(id),
  });
}

export function useUpdateEmailConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<EmailConfig> }) => {
      const result = await api.updateEmailConfig(id, updates);
      if (!result.success) throw new Error(result.error || '更新失败');
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailConfigs'] });
    },
  });
}

export function useDeleteEmailConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteEmailConfig(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailConfigs'] });
    },
  });
}

// Email Hooks
export function useSearchEmails() {
  return useMutation({
    mutationFn: (params: { configId: string; limit?: number; folderPath?: string; since?: string; before?: string }) =>
      api.searchEmails(params.configId, { limit: params.limit, folderPath: params.folderPath, since: params.since, before: params.before }),
  });
}

// 加载已保存的邮件（从数据库）
export function useSavedEmails() {
  return useQuery({
    queryKey: ['savedEmails'],
    queryFn: async () => {
      const response = await apiFetch('/api/emails/saved');
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result.data || { count: 0, total: 0, emails: [] };
    },
  });
}

export function useEmailFolders(configId?: string) {
  return useQuery({
    queryKey: ['emailFolders', configId],
    queryFn: async () => {
      if (!configId) return { folders: [] };
      const result = await api.getFolders(configId);
      if (result.error) throw new Error(result.error);
      // API 直接返回 { folders: [...] } 或 { success: true, folders: [...] }
      const folders = result.folders || result.data?.folders || [];
      return { folders };
    },
    enabled: !!configId,
  });
}

export function useTestConnectionAndGetFolders() {
  return useMutation({
    mutationFn: (config: {
      imapHost: string;
      imapPort: number;
      imapUsername: string;
      imapPassword: string;
      useTLS?: boolean;
      rejectUnauthorized?: boolean;
    }) => api.testConnectionAndGetFolders(config),
  });
}

export function useEmail(id?: string) {
  return useQuery({
    queryKey: ['email', id],
    queryFn: async () => {
      if (!id) return null;
      const result = await api.getEmail(id);
      if (!result.success) throw new Error(result.error);
      return result.data || null;
    },
    enabled: !!id,
  });
}

// Recipient Hooks
export function useRecipients(emailId?: string, postcardId?: string, id?: string) {
  return useQuery<Recipient[]>({
    queryKey: ['recipients', emailId, postcardId, id],
    queryFn: async () => {
      const result = await api.getRecipients(emailId, postcardId, id);
      if (!result.success) throw new Error(result.error);
      // 如果是按 id 查询，返回的是 { recipient } 格式
      if (id && (result.data as any)?.recipient) {
        return [(result.data as any).recipient];
      }
      return result.data || [];
    },
    enabled: true,
  });
}

export function useAnalyzeRecipient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recipientId: string) => api.analyzeRecipient(recipientId),
    onSuccess: () => {
      // 刷新所有 recipients 相关查询
      queryClient.invalidateQueries({ queryKey: ['recipients'] });
    },
  });
}

// Content Generation Hooks
export function useGenerateContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      recipientId: string;
      tone?: string;
      topics?: string[];
      userContent?: string[];
    }) => api.generateContent(params.recipientId, {
      tone: params.tone,
      topics: params.topics,
      userContent: params.userContent,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['generatedContent'] });
    },
  });
}

export function useGeneratedContent(id?: string) {
  return useQuery({
    queryKey: ['generatedContent', id],
    queryFn: async () => {
      if (!id) return null;
      const result = await api.getGeneratedContent(id);
      if (!result.success) throw new Error(result.error);
      return result.data || null;
    },
    enabled: !!id,
  });
}

export function useUpdateGeneratedContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { id: string; content: Partial<GeneratedContent> }) =>
      api.updateGeneratedContent(params.id, params.content),
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ['generatedContent', params.id] });
    },
  });
}

// Export Hooks
export function useExportMarkdown() {
  return useMutation({
    mutationFn: (contentId: string) => api.exportMarkdown(contentId),
  });
}

export function useExportHtml() {
  return useMutation({
    mutationFn: (contentId: string) => api.exportHtml(contentId),
  });
}

export function useExportPdf() {
  return useMutation({
    mutationFn: (params: { contentIds: string[]; format?: 'a4' | 'letter' }) =>
      api.exportPdf(params.contentIds, params.format || 'a4'),
  });
}

export function useAllPostcards(limit: number = 10) {
  return useQuery({
    queryKey: ['allPostcards', limit],
    queryFn: async () => {
      const result = await api.getAllPostcards(limit);
      if (!result.success) throw new Error(result.error);
      return result.data?.postcards || [];
    },
  });
}

// Template Hooks
export interface Template {
  id: string;
  name: string;
  content: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export function useTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const response = await apiFetch('/api/templates');

      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result.templates as Template[];
    },
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; content: string; category?: string }) => {
      const response = await apiFetch('/api/templates', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result.template as Template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiFetch(`/api/templates/${id}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; data: Partial<Omit<Template, 'id'>> }) => {
      const response = await apiFetch(`/api/templates/${params.id}`, {
        method: 'PUT',
        body: JSON.stringify(params.data),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result.template as Template;
    },
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.invalidateQueries({ queryKey: ['templates', params.id] });
    },
  });
}

export function useTemplate(id?: string) {
  return useQuery({
    queryKey: ['templates', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await apiFetch(`/api/templates/${id}/use`, {
        method: 'POST',
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result.template as Template;
    },
    enabled: !!id,
  });
}
