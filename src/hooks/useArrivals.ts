import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { apiFetch } from '@/lib/fetch';
import type { ArrivalReply } from '@/lib/types';

interface SearchResult {
  totalCount: number;
  existingCount: number;
  newCount: number;
  folder: string;
  searchQuery: string;
}

interface ParseProgress {
  progress: number;
  success: number;
  failed: number;
  skipped: number;
  current: number;
  total: number;
}

interface ParseEvent {
  type: 'status' | 'progress' | 'success' | 'skip' | 'error' | 'complete';
  data: any;
}

/**
 * 搜索抵达确认邮件（仅返回计数）
 */
export function useSearchArrivalEmails() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async ({
    configId,
    folder,
    limit = 20,
  }: {
    configId: string;
    folder?: string;
    limit?: number;
  }): Promise<SearchResult | null> => {
    setIsLoading(true);
    setError(null);

    try {
      // 从 localStorage 获取 token
      const token = typeof window !== 'undefined'
        ? localStorage.getItem('auth-storage')
          ? JSON.parse(localStorage.getItem('auth-storage')!).state.token
          : null
        : null;

      const response = await fetch('/api/arrivals/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ configId, folder, limit }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '搜索失败');
      }

      return result.data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { search, isLoading, error };
}

/**
 * 解析抵达确认邮件（SSE 实时进度）
 */
export function useParseArrivalEmails() {
  const [isParsing, setIsParsing] = useState(false);
  const [progress, setProgress] = useState<ParseProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parse = useCallback(async (
    {
      configId,
      folder,
      limit = 20,
      forceAll = false,
      forceReparse = false,
    }: {
      configId: string;
      folder?: string;
      limit?: number;
      forceAll?: boolean;
      forceReparse?: boolean;
    },
    onEvent?: (event: ParseEvent) => void
  ) => {
    setIsParsing(true);
    setError(null);

    try {
      // 从 localStorage 获取 token
      const token = typeof window !== 'undefined'
        ? localStorage.getItem('auth-storage')
          ? JSON.parse(localStorage.getItem('auth-storage')!).state.token
          : null
        : null;

      const response = await fetch('/api/arrivals/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ configId, folder, limit, forceAll, forceReparse }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '解析请求失败');
      }

      // 读取 SSE 流
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('无法读取响应');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 解析 SSE 事件
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const eventText of events) {
          const eventLines = eventText.trim().split('\n');
          let eventType = 'message';
          let eventData = '';

          for (const line of eventLines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7);
            } else if (line.startsWith('data: ')) {
              eventData = line.slice(6);
            }
          }

          try {
            const data = JSON.parse(eventData);

            // 更新进度状态
            if (eventType === 'progress') {
              setProgress(data);
            }

            // 调用回调
            onEvent?.({ type: eventType as any, data });

            // 完成或错误时结束
            if (eventType === 'complete' || eventType === 'error') {
              setIsParsing(false);
              return data;
            }
          } catch (e) {
            console.error('Parse SSE event error:', e);
          }
        }
      }
    } catch (err: any) {
      setError(err.message);
      setIsParsing(false);
      throw err;
    }
  }, []);

  return { parse, isParsing, progress, error };
}

/**
 * 获取已解析的抵达回复列表
 */
export function useArrivalsList() {
  const [arrivals, setArrivals] = useState<ArrivalReply[]>([]);
  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null>(null);
  const [stats, setStats] = useState<{ total: number; avgTravelDays?: number; byCountry: { country: string; count: number }[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchArrivals = useCallback(async ({
    page = 1,
    limit = 20,
    country,
  }: {
    page?: number;
    limit?: number;
    country?: string;
  } = {}) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', limit.toString());
      if (country) params.set('country', country);

      // 使用 authenticatedFetch 自动处理 token
      const response = await apiFetch(`/api/arrivals?${params}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '获取列表失败');
      }

      setArrivals(result.data.arrivals);
      setPagination(result.data.pagination);
      setStats(result.data.stats);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { arrivals, pagination, stats, isLoading, error, fetchArrivals };
}

/**
 * 删除抵达回复记录
 */
export function useDeleteArrivals() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteArrivals = useCallback(async (ids: string[]): Promise<boolean> => {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await apiFetch('/api/arrivals', {
        method: 'DELETE',
        body: JSON.stringify({ ids }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '删除失败');
      }

      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, []);

  return { deleteArrivals, isDeleting, error };
}
