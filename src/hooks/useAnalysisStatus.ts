import { useState, useCallback } from 'react';
// 使用 @/lib/api 而不是 @/lib/auth-fetch
import { apiFetch } from '@/lib/fetch';

export interface AnalysisStatus {
  total: number;
  analyzed: number;
  pending: number;
  hasMessage: number;
  noMessage: number;
  withTranslation: number;
  scoreDistribution: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
  progress: string;
}

interface UseAnalysisStatusReturn {
  status: AnalysisStatus | null;
  isLoading: boolean;
  isAnalyzing: boolean;
  error: string | null;
  fetchStatus: () => Promise<void>;
  continueAnalysis: () => Promise<{ success: boolean; message: string; count: number }>;
}

/**
 * 获取和管理 AI 分析状态的 Hook
 */
export function useAnalysisStatus(): UseAnalysisStatusReturn {
  const [status, setStatus] = useState<AnalysisStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiFetch('/api/arrivals/analysis/status');
      const result = await response.json();

      if (result.success) {
        setStatus(result.data);
      } else {
        setError(result.error || '获取状态失败');
      }
    } catch (err) {
      console.error('获取分析状态失败:', err);
      setError('获取状态失败，请重试');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const continueAnalysis = useCallback(async () => {
    try {
      setIsAnalyzing(true);
      setError(null);

      const response = await apiFetch('/api/arrivals/analysis/continue', {
        method: 'POST',
      });
      const result = await response.json();

      if (result.success) {
        // 延迟刷新状态（等待分析完成）
        setTimeout(() => {
          fetchStatus();
        }, 5000);

        return {
          success: true,
          message: result.message,
          count: result.data?.total || 0,
        };
      } else {
        setError(result.error || '触发分析失败');
        return { success: false, message: result.error, count: 0 };
      }
    } catch (err) {
      console.error('触发 AI 分析失败:', err);
      setError('触发分析失败，请重试');
      return { success: false, message: '触发分析失败', count: 0 };
    } finally {
      setIsAnalyzing(false);
    }
  }, [fetchStatus]);

  return {
    status,
    isLoading,
    isAnalyzing,
    error,
    fetchStatus,
    continueAnalysis,
  };
}
