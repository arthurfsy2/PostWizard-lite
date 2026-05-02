import { useState, useCallback } from 'react';
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

export interface AnalysisProgress {
  analyzed: number;
  total: number;
  saved?: number;
  phase?: 'scoring' | 'translating';
  translated?: number;
}

interface UseAnalysisStatusReturn {
  status: AnalysisStatus | null;
  isLoading: boolean;
  isAnalyzing: boolean;
  analysisProgress: AnalysisProgress | null;
  error: string | null;
  fetchStatus: () => Promise<void>;
  continueAnalysis: (onDone?: () => void) => Promise<{ success: boolean; message: string; count: number }>;
}

/**
 * 获取和管理 AI 分析状态的 Hook（SSE 实时进度）
 * @param source - 数据源：'arrivals'（留言精选）或 'received'（收信精选）
 */
export function useAnalysisStatus(source: 'arrivals' | 'received' = 'arrivals'): UseAnalysisStatusReturn {
  const [status, setStatus] = useState<AnalysisStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const basePath = source === 'received' ? '/api/received-cards/analysis' : '/api/arrivals/analysis';

  const fetchStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiFetch(`${basePath}/status`);
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
  }, [basePath]);

  const continueAnalysis = useCallback(async (onDone?: () => void) => {
    try {
      setIsAnalyzing(true);
      setAnalysisProgress(null);
      setError(null);

      const response = await apiFetch(`${basePath}/continue`, {
        method: 'POST',
      });

      if (!response.ok || !response.body) {
        throw new Error('请求失败');
      }

      // 读取 SSE 流
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalResult: { success: boolean; message: string; count: number } = {
        success: false,
        message: '分析未完成',
        count: 0,
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.started) {
              setAnalysisProgress({ analyzed: 0, total: data.total, phase: data.phase || 'scoring' });
              continue;
            }

            if (data.phase && !data.done) {
              setAnalysisProgress(prev => ({
                analyzed: data.analyzed ?? prev?.analyzed ?? 0,
                total: data.total || prev?.total || 0,
                saved: data.saved ?? prev?.saved,
                phase: data.phase,
                translated: data.translated ?? prev?.translated,
              }));
              continue;
            }

            if (data.analyzed !== undefined && !data.done && !data.phase) {
              setAnalysisProgress(prev => ({
                analyzed: data.analyzed,
                total: data.total || prev?.total || 0,
                saved: prev?.saved,
                phase: prev?.phase,
              }));
              continue;
            }

            if (data.done) {
              finalResult = {
                success: !data.error,
                message: data.error
                  ? `分析出错: ${data.error}`
                  : `分析完成，已保存 ${data.saved} 条${data.translated != null ? `，翻译 ${data.translated} 条` : ''}`,
                count: data.saved || 0,
              };
            }
          } catch {}
        }
      }

      // 刷新最终状态
      await fetchStatus();
      setAnalysisProgress(null);

      if (onDone) onDone();
      return finalResult;
    } catch (err) {
      console.error('触发 AI 分析失败:', err);
      setError('触发分析失败，请重试');
      setAnalysisProgress(null);
      return { success: false, message: '触发分析失败', count: 0 };
    } finally {
      setIsAnalyzing(false);
    }
  }, [fetchStatus]);

  return {
    status,
    isLoading,
    isAnalyzing,
    analysisProgress,
    error,
    fetchStatus,
    continueAnalysis,
  };
}
