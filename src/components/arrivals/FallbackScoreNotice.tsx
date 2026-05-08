'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/fetch';
import { cn } from '@/lib/utils';

interface FallbackStats {
  totalCount: number;
  analyzedCount: number;
  fallbackCount: number;
  fallbackPercentage: string;
  categoryStats: Record<string, { total: number; fallback: number }>;
}

export function FallbackScoreNotice() {
  const t = useTranslations('FallbackScore');
  const CATEGORIES = [
    { key: 'blessing' as const, label: t('catBlessing') },
    { key: 'funny' as const, label: t('catFunny') },
    { key: 'touching' as const, label: t('catTouching') },
    { key: 'cultural' as const, label: t('catCultural') },
  ] as const;

  const [stats, setStats] = useState<FallbackStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await apiFetch('/api/arrivals/stats');
        const result = await response.json();
        if (result.success) {
          setStats(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch fallback stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (isLoading) return null;
  if (!stats || stats.fallbackCount === 0) return null;

  // 过滤出有兜底分的分类
  const categoriesWithFallback = CATEGORIES.filter(
    (cat) => (stats.categoryStats[cat.key]?.fallback ?? 0) > 0
  );

  if (categoriesWithFallback.length === 0) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3">
        {/* 图标 */}
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-100">
          <AlertCircle className="h-4 w-4 text-amber-600" />
        </div>

        {/* 左侧文案 */}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-sm font-medium text-slate-800">
              {t('fallbackCount', { count: stats.fallbackCount })}
            </span>
            <span className="text-xs text-slate-500">
              {t('fallbackHint')}
            </span>
          </div>

          {/* 分类分布横向平铺 */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {categoriesWithFallback.map((cat) => {
              const count = stats.categoryStats[cat.key]?.fallback ?? 0;
              return (
                <span
                  key={cat.key}
                  className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-0.5 text-xs text-slate-600 ring-1 ring-amber-200"
                >
                  {cat.label}
                  <span className="font-medium text-amber-600">{count}</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
