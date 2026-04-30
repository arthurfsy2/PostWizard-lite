import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';

// AI 评价结果（三维度评分）
export interface AIEvaluation {
  touchingScore: number;        // 最走心 (0-100)
  emotionalScore: number;       // 情感温度 (0-100)
  culturalInsightScore: number; // 文化洞察 (0-100)
  summary: string;
  primaryCategory: 'touching' | 'culturalInsight' | 'emotional';
}

// 抽卡结果
export interface GachaResult {
  rarity: 'SSR' | 'SR' | 'R' | 'N';
  cardName: string;
  description: string;
  imageUrl: string;
  category: string;
  luckyLevel?: 'none' | 'lucky' | 'special' | 'superLucky';
  luckyBonus?: number;
  aiEvaluation: AIEvaluation;
}

// 抽卡历史记录
export interface GachaHistoryItem {
  id: string;
  cardName: string;
  description: string | null;
  imageUrl: string;
  rarity: string;
  category: string | null;
  obtainedAt: string;
}

// 稀有度统计
export interface RarityStats {
  SSR: number;
  SR: number;
  R: number;
  N: number;
}

// 抽卡 Hook
export function useGacha(externalToken?: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GachaResult | null>(null);
  const { token: authToken } = useAuth();
  
  // 优先使用外部传入的 token，否则使用内部获取的
  const token = externalToken || authToken;

  // 执行抽卡
  const draw = useCallback(async (
    postcardId: string,
    content: string,
    imageUrl?: string
  ): Promise<GachaResult | null> => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // 检查 token 是否存在
      const currentToken = externalToken || token;
      if (!currentToken) {
        throw new Error('未登录，请先登录');
      }

      const response = await fetch('/api/gacha/draw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`,
        },
        body: JSON.stringify({
          postcardId,
          content,
          imageUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        // console.error('[useGacha] API error:', data);
        throw new Error(data.error || `抽卡失败 (${response.status})`);
      }

      setResult(data.data);
      return data.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : '抽卡失败，请稍后重试';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [token, externalToken]);

  // 获取抽卡历史
  const getHistory = useCallback(async (limit?: number): Promise<{
    history: GachaHistoryItem[];
    stats: RarityStats;
    total: number;
  } | null> => {
    try {
      const currentToken = externalToken || token;
      if (!currentToken) {
        throw new Error('未登录，请先登录');
      }
      
      const url = limit ? `/api/gacha/history?limit=${limit}` : '/api/gacha/history';
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${currentToken}`,
        },
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '获取历史失败');
      }

      return data.data;
    } catch (err) {
      // console.error('获取抽卡历史失败:', err);
      return null;
    }
  }, [token, externalToken]);

  // 获取卡池配置
  const getConfig = useCallback(async (): Promise<{
    pool: any;
    rarities: Record<string, { name: string; probability: string; color: string; description: string }>;
  } | null> => {
    try {
      const response = await fetch('/api/gacha/draw');
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '获取配置失败');
      }

      return data.data;
    } catch (err) {
      // console.error('获取卡池配置失败:', err);
      return null;
    }
  }, []);

  return {
    loading,
    error,
    result,
    draw,
    getHistory,
    getConfig,
  };
}
