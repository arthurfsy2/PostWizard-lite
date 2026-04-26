"use client";

import { useState, useEffect } from "react";
import { Loader2, RefreshCw, ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HIGHLIGHT_CATEGORIES, type HighlightCategory, type HighlightCategoryInfo } from "@/types/highlights";
import { useHighlights } from "@/hooks/useHighlights";
import { useAnalysisStatus } from "@/hooks/useAnalysisStatus";
import { HighlightsCard } from "./HighlightsCard";
import { HighlightsEmptyState } from "./HighlightsEmptyState";
import { toast } from "sonner";

interface HighlightsContainerProps {
  /** 默认选中的分类 */
  defaultCategory?: HighlightCategory;
  /** 每页显示数量 */
  limit?: number;
  /** 是否显示头部信息 */
  showHeader?: boolean;
}

/**
 * 留言精选主容器组件
 * 管理 Tab 切换和数据获取
 */
export function HighlightsContainer({
  defaultCategory = "touching",
  limit = 10,
  showHeader = true,
}: HighlightsContainerProps) {
  const [activeCategory, setActiveCategory] = useState<HighlightCategory>(defaultCategory);
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(false);
  const [isPolling, setIsPolling] = useState(false); // 是否正在轮询分析进度

  const {
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
    refresh,
    loadMore,
  } = useHighlights({
    category: activeCategory,
    limit,
    autoFetch: true,
  });

  const {
    status,
    isLoading: isStatusLoading,
    isAnalyzing,
    fetchStatus,
    continueAnalysis,
  } = useAnalysisStatus();

  const totalStatusCount = status ? status.analyzed + status.pending : 0;
  const pendingCount = status?.pending ?? 0;
  const analyzedCount = status?.analyzed ?? totalAnalyzed;
  const shouldShowContinueButton = pendingCount > 0;
  const shouldShowPendingHint = pendingCount > 0 && totalStatusCount > 0;

  // 初始加载时获取分析状态（仅挂载时执行一次）
  useEffect(() => {
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 自动轮询：仅在用户点击"继续分析"后，每 3 秒刷新一次状态和精选
  useEffect(() => {
    if (!isPolling || !status || status.pending === 0) return;

    const timer = setInterval(() => {
      fetchStatus();
      refresh();
    }, 3000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPolling, status?.pending]);

  // 分析完成时停止轮询
  useEffect(() => {
    if (isPolling && status && status.pending === 0) {
      setIsPolling(false);
      toast.success('✨ 所有留言分析完成！');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.pending]);

  const handleCategoryChange = (category: HighlightCategory) => {
    setActiveCategory(category);
  };

  const handleRefresh = () => {
    refresh();
  };

  const handleContinueAnalysis = async () => {
    if (!status || pendingCount === 0) {
      toast.info('暂时没有需要继续分析的留言');
      return;
    }

    setIsPolling(true); // 开始轮询
    const result = await continueAnalysis();
    if (result.success) {
      toast.success(`已开始补全剩余 ${result.count} 条留言的精选分析，请稍候...`);
    } else {
      toast.error(result.message);
      setIsPolling(false); // 失败时停止轮询
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-6">
      {/* Header */}
      {showHeader && (
        <div className="space-y-4">
          {/* 主标题栏 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center text-xl shadow-md">
                💬
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">留言精选</h2>
                {analyzedCount > 0 && (
                  <p className="text-xs text-gray-500">
                    已分析 {analyzedCount} 条留言
                    {totalStatusCount > 0 && <span className="ml-1">/ {totalStatusCount} 条</span>}
                    {cached && <span className="ml-1 text-blue-500">(缓存)</span>}
                  </p>
                )}
                {shouldShowPendingHint && (
                  <p className="mt-1 text-xs text-orange-600">
                    还有 {pendingCount} 条留言尚未完成分析，可继续补全。
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {shouldShowContinueButton && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleContinueAnalysis}
                  disabled={isAnalyzing}
                  className="text-purple-600 border-purple-300 hover:bg-purple-50"
                  title={`继续补全剩余 ${pendingCount} 条留言的精选分析`}
                >
                  <Sparkles className={`w-4 h-4 mr-1.5 ${isAnalyzing ? "animate-spin" : ""}`} />
                  {isAnalyzing ? "补分析中..." : `继续分析剩余留言 (${pendingCount})`}
                </Button>
              )}
              {/* 刷新按钮 */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="text-gray-600 hover:text-orange-600"
              >
                <RefreshCw className={`w-4 h-4 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`} />
                {isRefreshing ? "刷新中..." : "刷新"}
              </Button>
            </div>
          </div>

          {/* 分析状态面板 */}
          {status && (
            <div className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-lg p-4 border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">📊 AI 分析进度</h3>
                <button
                  onClick={() => fetchStatus()}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  <RefreshCw className="w-3 h-3 inline mr-1" />
                  刷新
                </button>
              </div>
              
              {shouldShowPendingHint && (
                <div className="mb-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700">
                  当前已完成 {status.analyzed}/{totalStatusCount} 条留言分析，剩余 {pendingCount} 条可继续补全。若刚刚搜索过邮件或中途网络波动，可点击右上角“继续分析剩余留言”。
                </div>
              )}

              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600">已分析 {status.analyzed}/{status.total}</span>
                  <span className="text-gray-600">{status.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-green-500 to-emerald-500 h-full transition-all duration-500"
                    style={{ width: `${status.progress}%` }}
                  />
                </div>
              </div>

              {/* 详细统计 */}
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="bg-white rounded p-2 text-center border border-slate-100">
                  <div className="text-gray-500">待分析</div>
                  <div className={`font-bold ${status.pending > 0 ? 'text-orange-600' : 'text-gray-700'}`}>
                    {status.pending}
                  </div>
                </div>
                <div className="bg-white rounded p-2 text-center border border-slate-100">
                  <div className="text-gray-500">优秀 (80+)</div>
                  <div className="font-bold text-green-600">{status.scoreDistribution.excellent}</div>
                </div>
                <div className="bg-white rounded p-2 text-center border border-slate-100">
                  <div className="text-gray-500">良好 (60-79)</div>
                  <div className="font-bold text-blue-600">{status.scoreDistribution.good}</div>
                </div>
                <div className="bg-white rounded p-2 text-center border border-slate-100">
                  <div className="text-gray-500">有翻译</div>
                  <div className="font-bold text-purple-600">{status.withTranslation}</div>
                </div>
              </div>

              {/* 低分提示 */}
              {status.scoreDistribution.poor > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  ℹ️ {status.scoreDistribution.poor} 条留言评分较低（&lt;40 分），可能需要优化 AI Prompt
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 切换 */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {HIGHLIGHT_CATEGORIES.map((cat) => (
          <TabButton
            key={cat.key}
            category={cat}
            isActive={activeCategory === cat.key}
            onClick={() => handleCategoryChange(cat.key)}
          />
        ))}
      </div>

      {/* Loading 状态 */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      )}

      {/* Error 状态 */}
      {error && (
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">{error}</p>
          <Button
            variant="outline"
            onClick={handleRefresh}
            className="text-orange-600 border-orange-300 hover:bg-orange-50"
          >
            重试
          </Button>
        </div>
      )}

      {/* Empty 状态 */}
      {!isLoading && !error && emptyState && (
        <HighlightsEmptyState
          category={activeCategory}
          emptyState={emptyState}
        />
      )}

      {/* 数据列表 */}
      {!isLoading && !error && !emptyState && highlights.length > 0 && (
        <div className="space-y-4">
          {highlights.map((highlight, index) => (
            <HighlightsCard
              key={highlight.id}
              highlight={highlight}
              index={index}
            />
          ))}

          {/* 加载更多 */}
          {hasMore && (
            <div className="pt-4 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={loadMore}
                disabled={isLoadingMore}
                className="text-gray-600 hover:text-orange-600 border-dashed"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    加载中...
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 mr-1.5" />
                    加载更多（已显示 {highlights.length}/{totalCount} 条）
                  </>
                )}
              </Button>
            </div>
          )}

          {/* 已全部加载 */}
          {!hasMore && highlights.length > 0 && totalCount > 0 && (
            <p className="text-center text-xs text-gray-400 pt-2">
              已显示全部 {totalCount} 条精选留言
            </p>
          )}
        </div>
      )}

      {/* 无数据状态 */}
      {!isLoading && !error && !emptyState && highlights.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>暂无精选留言</p>
        </div>
      )}
    </div>
  );
}

/**
 * Tab 切换按钮
 */
function TabButton({
  category,
  isActive,
  onClick,
}: {
  category: HighlightCategoryInfo;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap
        transition-all duration-300 ease-out
        ${
          isActive
            ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/30"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
        }
      `}
    >
      <span className="text-base">{category.icon}</span>
      <span>{category.label}</span>
    </button>
  );
}
