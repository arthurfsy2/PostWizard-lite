'use client';

import { useAuthStore } from '@/lib/stores/auth-store';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Lightbulb, 
  Plus, 
  X, 
  MapPin, 
  TrendingUp, 
  Calendar, 
  Sparkles,
  Loader2,
  Check,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';
// 推荐类型
interface Recommendation {
  id: string;
  type: 'country_based' | 'match_based' | 'trending_tags' | 'seasonal';
  title: string;
  description: string;
  suggestion: string;
  category: string;
  reason: string;
  confidence: number;
  metadata?: Record<string, unknown>;
}

// 统计信息
interface RecommendationStats {
  totalSent: number;
  topCountries: { country: string; count: number; percentage: number }[];
  topTags: { tag: string; count: number }[];
  completionRate: number;
}

// 分类名称映射
const CATEGORY_NAMES: Record<string, string> = {
  self_intro: '自我介绍',
  hobbies: '兴趣爱好',
  hometown: '家乡介绍',
  travel_stories: '旅行故事',
  fun_facts: '有趣故事',
};

// 分类图标映射
const CATEGORY_ICONS: Record<string, string> = {
  self_intro: '👤',
  hobbies: '🎨',
  hometown: '🏠',
  travel_stories: '✈️',
  fun_facts: '🎭',
};

// 获取推荐类型图标
function getTypeIcon(type: Recommendation['type']) {
  switch (type) {
    case 'country_based':
      return <MapPin className="w-4 h-4" />;
    case 'trending_tags':
      return <TrendingUp className="w-4 h-4" />;
    case 'seasonal':
      return <Calendar className="w-4 h-4" />;
    case 'match_based':
    default:
      return <Sparkles className="w-4 h-4" />;
  }
}

// 获取推荐类型标签
function getTypeLabel(type: Recommendation['type']) {
  switch (type) {
    case 'country_based':
      return '基于寄信国家';
    case 'trending_tags':
      return '热门标签';
    case 'seasonal':
      return '季节推荐';
    case 'match_based':
    default:
      return '智能推荐';
  }
}

// 获取推荐类型颜色
function getTypeColor(type: Recommendation['type']) {
  switch (type) {
    case 'country_based':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'trending_tags':
      return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'seasonal':
      return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'match_based':
    default:
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  }
}

interface RecommendationPanelProps {
  onApply?: (category: string, content: string) => void;
}

export function RecommendationPanel({ onApply }: RecommendationPanelProps) {
  const { token } = useAuthStore();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [stats, setStats] = useState<RecommendationStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [applyingId, setApplyingId] = useState<string | null>(null);

  // 加载推荐
  useEffect(() => {
    if (!token) return;
    loadRecommendations();
  }, [token]);

  const loadRecommendations = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/materials/recommendations?includeStats=true', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('获取推荐失败');
      }

      const data = await response.json();
      setRecommendations(data.recommendations || []);
      setStats(data.stats || null);
    } catch (err) {
      // console.error('加载推荐失败:', err);
      setError('获取推荐失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 应用推荐（一键添加）
  const handleApply = async (recommendation: Recommendation) => {
    if (applyingId) return;

    setApplyingId(recommendation.id);
    try {
      const response = await fetch('/api/materials/recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recommendationId: recommendation.id,
          category: recommendation.category,
          content: recommendation.suggestion,
        }),
      });

      if (!response.ok) {
        throw new Error('添加失败');
      }

      // 标记为已应用
      setAppliedIds(prev => new Set([...prev, recommendation.id]));

      // 通知父组件
      onApply?.(recommendation.category, recommendation.suggestion);

      // 记录反馈
      await fetch('/api/materials/recommendations/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recommendationId: recommendation.id,
          action: 'accepted',
          category: recommendation.category,
        }),
      });
    } catch (err) {
      // console.error('应用推荐失败:', err);
      alert('添加失败，请重试');
    } finally {
      setApplyingId(null);
    }
  };

  // 不感兴趣
  const handleDismiss = async (recommendation: Recommendation) => {
    setDismissedIds(prev => new Set([...prev, recommendation.id]));

    // 记录反馈
    try {
      await fetch('/api/materials/recommendations/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recommendationId: recommendation.id,
          action: 'not_interested',
          category: recommendation.category,
        }),
      });
    } catch (err) {
      // console.error('记录反馈失败:', err);
    }
  };

  // 刷新推荐
  const handleRefresh = () => {
    loadRecommendations();
  };

  // 过滤掉已应用和不感兴趣的
  const visibleRecommendations = recommendations.filter(
    r => !appliedIds.has(r.id) && !dismissedIds.has(r.id)
  );

  if (isLoading) {
    return (
      <Card className="border-0 shadow-lg shadow-slate-200/50">
        <CardContent className="py-12">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            <p className="text-slate-500">正在分析你的寄信习惯...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-0 shadow-lg shadow-slate-200/50">
        <CardContent className="py-8">
          <div className="text-center space-y-4">
            <p className="text-red-500">{error}</p>
            <Button onClick={handleRefresh} variant="outline" size="sm">
              重试
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* 头部统计 */}
      {stats && stats.totalSent > 0 && (
        <Card className="border-0 shadow-lg shadow-slate-200/50 bg-gradient-to-br from-orange-50 to-amber-50">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-500">已寄出:</span>
                <span className="font-semibold text-orange-600">{stats.totalSent} 封</span>
              </div>
              {stats.completionRate < 100 && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">素材完善度:</span>
                  <span className="font-semibold text-orange-600">{stats.completionRate}%</span>
                </div>
              )}
              {stats.topCountries.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">常寄往:</span>
                  <div className="flex gap-1">
                    {stats.topCountries.slice(0, 3).map((c, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {c.country}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 推荐列表 */}
      {visibleRecommendations.length === 0 ? (
        <Card className="border-0 shadow-lg shadow-slate-200/50">
          <CardContent className="py-8">
            <div className="text-center space-y-2">
              <Lightbulb className="w-12 h-12 mx-auto text-slate-300" />
              <p className="text-slate-500">暂无新的推荐</p>
              <p className="text-sm text-slate-400">多寄一些明信片，我们会为你生成更精准的推荐</p>
              <Button onClick={handleRefresh} variant="outline" size="sm" className="mt-4">
                刷新
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-600 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-orange-500" />
              为你推荐 ({visibleRecommendations.length})
            </h3>
            <Button onClick={handleRefresh} variant="ghost" size="sm" className="text-slate-400">
              刷新
            </Button>
          </div>

          {visibleRecommendations.map((recommendation) => (
            <Card 
              key={recommendation.id} 
              className="border-0 shadow-md hover:shadow-lg transition-shadow duration-200"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge 
                        variant="outline" 
                        className={`text-xs flex items-center gap-1 ${getTypeColor(recommendation.type)}`}
                      >
                        {getTypeIcon(recommendation.type)}
                        {getTypeLabel(recommendation.type)}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {CATEGORY_ICONS[recommendation.category]} {CATEGORY_NAMES[recommendation.category]}
                      </Badge>
                    </div>
                    <CardTitle className="text-base font-semibold text-slate-900">
                      {recommendation.title}
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-500 mt-1">
                      {recommendation.description}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-400 hover:text-slate-600 shrink-0"
                    onClick={() => handleDismiss(recommendation)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="bg-slate-50 rounded-lg p-3 mb-3">
                  <p className="text-sm text-slate-700">{recommendation.suggestion}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">{recommendation.reason}</p>
                  <Button
                    onClick={() => handleApply(recommendation)}
                    disabled={applyingId === recommendation.id}
                    size="sm"
                    className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
                  >
                    {applyingId === recommendation.id ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        添加中...
                      </>
                    ) : (
                      <>
                        <Plus className="h-3 w-3 mr-1" />
                        一键添加
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 已应用的推荐 */}
      {appliedIds.size > 0 && (
        <div className="pt-4 border-t border-slate-100">
          <p className="text-sm text-slate-500 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-500" />
            已添加 {appliedIds.size} 条推荐素材
          </p>
        </div>
      )}
    </div>
  );
}
