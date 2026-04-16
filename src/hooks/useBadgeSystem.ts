import { useState, useEffect, useCallback } from 'react';
import { Badge, MaterialProgress } from '@/lib/badge/types';

interface ProgressData {
  progress: MaterialProgress;
  badges: { badge: Badge; unlockedAt: string; isNew: boolean }[];
  nextAchievements: {
    badge: Badge;
    currentProgress: number;
    requiredProgress: number;
    percentage: number;
  }[];
}

interface UseBadgeSystemReturn {
  data: ProgressData | null;
  loading: boolean;
  error: string | null;
  checking: boolean;
  newUnlocks: Badge[];
  fetchProgress: () => Promise<void>;
  checkAchievements: () => Promise<void>;
  markBadgeViewed: (badgeId: string) => Promise<void>;
}

export function useBadgeSystem(): UseBadgeSystemReturn {
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [newUnlocks, setNewUnlocks] = useState<Badge[]>([]);

  const fetchProgress = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/materials/progress');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '获取进度失败');
      }
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, []);

  const checkAchievements = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      const response = await fetch('/api/materials/check-achievements', {
        method: 'POST',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '检查成就失败');
      }
      const result = await response.json();
      if (result.success) {
        setData((prev) => ({
          ...result.data,
          progress: prev?.progress || result.data.progress,
        }));
        if (result.data.unlockedThisTime?.length > 0) {
          setNewUnlocks(result.data.unlockedThisTime.map((u: { badge: Badge }) => u.badge));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setChecking(false);
    }
  }, []);

  const markBadgeViewed = useCallback(async (badgeId: string) => {
    try {
      const response = await fetch(`/api/materials/badges/${badgeId}/viewed`, {
        method: 'POST',
      });
      if (response.ok) {
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            badges: prev.badges.map((b) =>
              b.badge.id === badgeId ? { ...b, isNew: false } : b
            ),
          };
        });
      }
    } catch (err) {
      // console.error('标记徽章已查看失败:', err);
    }
  }, []);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  return {
    data,
    loading,
    error,
    checking,
    newUnlocks,
    fetchProgress,
    checkAchievements,
    markBadgeViewed,
  };
}
