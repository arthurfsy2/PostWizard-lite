import { useState, useCallback, useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/fetch';
import type { 
  HighlightCategory, 
  HighlightsResponse, 
  HighlightItem,
  HighlightsEmptyState 
} from '@/types/highlights';

interface UseHighlightsOptions {
  category?: HighlightCategory;
  limit?: number;
  autoFetch?: boolean;
}

interface UseHighlightsReturn {
  highlights: HighlightItem[];
  isLoading: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  error: string | null;
  emptyState: HighlightsEmptyState | null;
  totalAnalyzed: number;
  totalCount: number;
  hasMore: boolean;
  cached: boolean;
  updatedAt: string | null;
  fetchHighlights: (force?: boolean) => Promise<void>;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

/**
 * 获取留言精选数据（支持分页）
 * @param options - 配置选项
 * @returns 留言精选数据和状态
 */
export function useHighlights(options: UseHighlightsOptions = {}): UseHighlightsReturn {
  const { category, limit = 10, autoFetch = true } = options;
  
  const [highlights, setHighlights] = useState<HighlightItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emptyState, setEmptyState] = useState<HighlightsEmptyState | null>(null);
  const [totalAnalyzed, setTotalAnalyzed] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [cached, setCached] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  // 竞态控制：每个请求携带版本号，过期响应直接丢弃
  const versionRef = useRef(0);
  const offsetRef = useRef(0);

  const fetchHighlights = useCallback(async (force = false, append = false) => {
    // 递增版本号，后续旧响应会被忽略
    const thisVersion = ++versionRef.current;

    if (append) {
      setIsLoadingMore(true);
    } else if (force) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);
    if (!append) setEmptyState(null);

    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (limit) params.set('limit', limit.toString());
      if (force) params.set('force', '1');
      if (append) {
        params.set('offset', offsetRef.current.toString());
      }

      const response = await apiFetch(`/api/arrivals/highlights?${params}`);
      const result = await response.json();

      // 竞态：若版本已过期（说明有新请求发出），丢弃本响应
      if (thisVersion !== versionRef.current) {
        return;
      }

      if (!result.success) {
        // 处理空状态
        if (result.emptyState) {
          setEmptyState(result.emptyState);
          setHighlights([]);
          return;
        }
        throw new Error(result.error || '获取精选留言失败');
      }

      const newHighlights = result.highlights || [];

      if (append) {
        setHighlights(prev => {
          // 竞态双重检查：append 时也验证版本，并去重已有 ID
          if (thisVersion !== versionRef.current) return prev;
          const existingIds = new Set(prev.map(h => h.id));
          const uniqueNew = newHighlights.filter(h => !existingIds.has(h.id));
          return [...prev, ...uniqueNew];
        });
        offsetRef.current += newHighlights.length;
      } else {
        setHighlights(newHighlights);
        offsetRef.current = newHighlights.length;
      }
      
      setTotalAnalyzed(result.totalAnalyzed || 0);
      setTotalCount(result.totalCount || 0);
      setHasMore(result.hasMore || false);
      setCached(result.cached || false);
      setUpdatedAt(result.updatedAt || null);
    } catch (err: any) {
      // 竞态检查：忽略过期请求的错误
      if (thisVersion !== versionRef.current) return;
      setError(err.message);
      if (!append) setHighlights([]);
    } finally {
      // 竞态检查：只在自己是最新的请求时才清除 loading 状态
      if (thisVersion === versionRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    }
  }, [category, limit]);

  const refresh = useCallback(async () => {
    offsetRef.current = 0;
    await fetchHighlights(true, false);
  }, [fetchHighlights]);

  const loadMore = useCallback(async () => {
    await fetchHighlights(false, true);
  }, [fetchHighlights]);

  // 切换分类时重置分页
  useEffect(() => {
    offsetRef.current = 0;
    setHighlights([]);
    setHasMore(false);
  }, [category]);

  // 自动获取数据
  useEffect(() => {
    if (autoFetch) {
      fetchHighlights();
    }
  }, [category, autoFetch, fetchHighlights]);

  return {
    highlights,
    isLoading,
    isRefreshing,
    isLoadingMore,
    error,
    emptyState,
    totalAnalyzed,
    totalCount,
    hasMore,
    cached,
    updatedAt,
    fetchHighlights,
    refresh,
    loadMore,
  };
}
