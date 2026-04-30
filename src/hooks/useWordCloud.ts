'use client';

import useSWR from 'swr';
import { WordCloudData } from '@/types/wordcloud';
import { apiFetch } from '@/lib/fetch';

/**
 * 词云数据获取 Hook
 * 
 * 使用 SWR 进行数据获取和缓存
 * 
 * @param language - 语言模式：'en' | 'zh' | 'all'
 * @param forceRefresh - 是否强制刷新（绕过缓存，从数据库重新生成）
 */
export function useWordCloud(language: 'zh' | 'en' | 'all' = 'en', forceRefresh: boolean = false, source: 'arrivals' | 'received' = 'arrivals') {
  const basePath = source === 'received' ? '/api/received-cards/wordcloud' : '/api/arrivals/wordcloud';
  // 生成唯一 key，包含 force 参数
  const cacheKey = forceRefresh
    ? `${basePath}?language=${language}&t=${Date.now()}`
    : `${basePath}?language=${language}`;
  
  const { data, error, isLoading, mutate } = useSWR<WordCloudData>(
    cacheKey,
    async (url: string) => {
      const res = await apiFetch(url);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to fetch word cloud');
      }
      return res.json();
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 分钟内不重复请求
      refreshInterval: 0, // 不自动刷新
    }
  );

  return { 
    data, 
    error, 
    isLoading,
    refresh: mutate,
  };
}
