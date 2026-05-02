/**
 * API 客户端封装
 * 统一的 API 请求处理
 */

import { EmailConfig, SentCardContent } from './types';

// 类型定义
export interface Email {
  id: string;
  emailConfigId: string;
  uid: string;
  messageId?: string;
  subject: string;
  from: string;
  to: string;
  receivedAt: Date;
  bodyText?: string;
  bodyHtml?: string;
  postcardId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Recipient {
  id: string;
  postcardId: string;
  emailId: string;
  name: string;
  country: string;
  city: string;
  address: string;
  age?: number;
  gender?: string;
  interests?: string;
  bio?: string;
  createdAt: Date;
  updatedAt: Date;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

// 获取认证 token 的函数
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const authData = localStorage.getItem('auth-storage');
    if (!authData) return null;
    const parsed = JSON.parse(authData);
    return parsed.state?.token || null;
  } catch (error) {
    // console.error('Failed to get auth token:', error);
    return null;
  }
}

// 创建带认证的 fetch 请求
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  
  const headers = new Headers(options.headers || {});
  
  // 自动添加 Authorization header（如果 token 存在且 headers 中没有 Authorization）
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  // 默认 Content-Type
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  
  return fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 用户类型定义
interface UserInfo {
  id: string;
  email: string;
  plan: string;
  freeUsedCount: number;
  freeQuota: number;
  planExpiresAt: string | null;
}

// ... 其他接口定义保持不变 ...

export class ApiClient {
  // 邮箱配置相关方法
  static async getEmailConfigs(): Promise<ApiResponse<EmailConfig[]>> {
    const response = await apiFetch('/email-configs');
    return response.json();
  }

  static async createEmailConfig(config: Omit<EmailConfig, 'id'>): Promise<ApiResponse<EmailConfig>> {
    const response = await apiFetch('/email-configs', {
      method: 'POST',
      body: JSON.stringify(config),
    });
    return response.json();
  }

  static async updateEmailConfig(id: string, updates: Partial<EmailConfig>): Promise<ApiResponse<EmailConfig>> {
    const response = await apiFetch(`/email-configs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return response.json();
  }

  static async deleteEmailConfig(id: string): Promise<ApiResponse<void>> {
    const response = await apiFetch(`/email-configs/${id}`, {
      method: 'DELETE',
    });
    return response.json();
  }

  static async testEmailConfig(id: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    const response = await apiFetch(`/email-configs/${id}/test`, {
      method: 'POST',
    });
    return response.json();
  }

  static async testConnectionAndGetFolders(config: {
    imapHost: string;
    imapPort: number;
    imapUsername: string;
    imapPassword: string;
    useTLS?: boolean;
    rejectUnauthorized?: boolean;
  }): Promise<ApiResponse<{ success: boolean; folders: string[]; message?: string }>> {
    const response = await apiFetch('/email-configs/test-connection', {
      method: 'POST',
      body: JSON.stringify(config),
    });
    return response.json();
  }

  static async getFolders(configId: string): Promise<ApiResponse<{ success: boolean; folders: string[] }>> {
    const response = await apiFetch(`/email-configs/${configId}/folders`, {
      method: 'GET',
    });
    return response.json();
  }

  // 用户认证相关
  static async getCurrentUser(): Promise<ApiResponse<{ user: UserInfo }>> {
    const response = await apiFetch('/auth/me');
    return response.json();
  }

  // 导出相关方法
  static async exportMarkdown(contentId: string): Promise<ApiResponse<{ markdown: string }> & { markdown?: string; filename?: string }> {
    const response = await apiFetch(`/content/${contentId}/export-markdown`);
    return response.json();
  }


  static async exportHtml(contentId: string): Promise<ApiResponse<{ html: string }>> {
    const response = await apiFetch(`/content/${contentId}/export-html`);
    return response.json();
  }

  static async exportPdf(postcards: unknown[], format: 'a4' | 'letter' = 'a4'): Promise<ApiResponse<{ pdf: Blob }>> {
    const response = await apiFetch('/content/export-pdf', {
      method: 'POST',
      body: JSON.stringify({ postcards, format }),
    });
    const blob = await response.blob();
    return {
      success: response.ok,
      data: { pdf: blob }
    };
  }
}

// 为了保持向后兼容，保留原有的 api 对象
export const api = {
  // Email Config
  getEmailConfigs: ApiClient.getEmailConfigs,
  createEmailConfig: ApiClient.createEmailConfig,
  updateEmailConfig: ApiClient.updateEmailConfig,
  deleteEmailConfig: ApiClient.deleteEmailConfig,
  testEmailConfig: ApiClient.testEmailConfig,
  testConnectionAndGetFolders: ApiClient.testConnectionAndGetFolders,
  getFolders: ApiClient.getFolders,
  
  // User Auth
  getCurrentUser: ApiClient.getCurrentUser,

  // Email Search
  async searchEmails(configId: string, options?: {
    limit?: number;
    folderPath?: string;
    since?: string;
    before?: string;
  }): Promise<ApiResponse<{ count: number; emails: Email[] }>> {
    const response = await apiFetch('/api/emails/search', {
      method: 'POST',
      body: JSON.stringify({
        configId,
        folder: options?.folderPath,
        limit: options?.limit,
        since: options?.since,
        before: options?.before,
      }),
    });
    return response.json();
  },

  // Get single email
  async getEmail(id: string): Promise<ApiResponse<Email>> {
    const response = await apiFetch(`/api/emails/${encodeURIComponent(id)}`);
    return response.json();
  },

  // Get recipients
  async getRecipients(emailId?: string, postcardId?: string, id?: string): Promise<ApiResponse<Recipient[] | { recipient: Recipient }>> {
    const params = new URLSearchParams();
    if (emailId) params.append('emailId', emailId);
    if (postcardId) params.append('postcardId', postcardId);
    if (id) params.append('id', id);
    const response = await apiFetch(`/recipients?${params.toString()}`);
    return response.json();
  },

  // Analyze recipient
  async analyzeRecipient(recipientId: string): Promise<ApiResponse<unknown>> {
    const response = await apiFetch(`/recipients/${encodeURIComponent(recipientId)}/analyze`, {
      method: 'POST',
    });
    return response.json();
  },

  // Generate content
  async generateContent(recipientId: string, options?: {
    tone?: string;
    topics?: string[];
    userContent?: string[];
  }): Promise<ApiResponse<SentCardContent>> {
    const response = await apiFetch('/content/generate', {
      method: 'POST',
      body: JSON.stringify({
        recipientId,
        tone: options?.tone,
        topics: options?.topics,
        userContent: options?.userContent,
      }),
    });
    return response.json();
  },

  // Get all postcards
  async getAllPostcards(limit: number = 10): Promise<ApiResponse<{ postcards: unknown[] }>> {
    const response = await apiFetch(`/content/postcards?limit=${limit}`);
    return response.json();
  },
  
  // Export functions
  async exportPdf(contentIds: string[], format: 'a4' | 'letter' = 'a4') {
    const response = await apiFetch('/export/pdf', {
      method: 'POST',
      body: JSON.stringify({ contentIds, format }),
    });
    return response.json();
  },
  
  async exportMarkdown(contentId: string) {
    const response = await apiFetch(`/content/${encodeURIComponent(contentId)}/export-markdown`);
    return response.json();
  },
  
  async exportHtml(contentId: string) {
    const response = await apiFetch(`/content/${encodeURIComponent(contentId)}/export-html`);
    return response.json();
  },

  // 获取生成的内容
  async getSentCardContent(contentId: string): Promise<ApiResponse<SentCardContent>> {
    const response = await apiFetch(`/content/${encodeURIComponent(contentId)}`);
    return response.json();
  },

  // 更新生成的内容
  async updateSentCardContent(contentId: string, content: Partial<SentCardContent>): Promise<ApiResponse<SentCardContent>> {
    const response = await apiFetch(`/content/${encodeURIComponent(contentId)}`, {
      method: 'PUT',
      body: JSON.stringify(content),
    });
    return response.json();
  },
};