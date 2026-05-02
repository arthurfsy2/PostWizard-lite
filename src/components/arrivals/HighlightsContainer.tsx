"use client";

import { useState, useEffect } from "react";
import { Loader2, RefreshCw, TrendingUp, Quote, Star, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HIGHLIGHT_CATEGORIES, RECEIVED_HIGHLIGHT_CATEGORIES, type HighlightCategory, type HighlightCategoryInfo } from "@/types/highlights";
import { useHighlights } from "@/hooks/useHighlights";
import { useAnalysisStatus } from "@/hooks/useAnalysisStatus";
import { HighlightsCard } from "./HighlightsCard";
import { HighlightsEmptyState } from "./HighlightsEmptyState";
import { getFlagEmoji } from "@/lib/flag-emoji";
import { getCountryNameCN } from "@/lib/country-codes";
import { toast } from "sonner";

interface HighlightsContainerProps {
  /** 默认选中的分类 */
  defaultCategory?: HighlightCategory;
  /** 每页显示数量 */
  limit?: number;
  /** 是否显示头部信息 */
  showHeader?: boolean;
  /** 数据源：arrivals（留言精选）或 received（收信精选） */
  source?: 'arrivals' | 'received';
}

/**
 * 留言精选主容器组件
 * 管理 Tab 切换和数据获取
 */
export function HighlightsContainer({
  defaultCategory = "touching",
  limit = 20,
  showHeader = true,
  source = "arrivals",
}: HighlightsContainerProps) {
  const [activeCategory, setActiveCategory] = useState<HighlightCategory>(defaultCategory);
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(false);
  const [isTranslatingBatch, setIsTranslatingBatch] = useState(false);
  const [translateProgress, setTranslateProgress] = useState<{ progress: number; total: number; translated: number } | null>(null);

  const {
    highlights,
    isLoading,
    isRefreshing,
    error,
    emptyState,
    totalCards,
    refresh,
  } = useHighlights({
    category: activeCategory,
    limit,
    autoFetch: true,
    source,
  });

  const {
    status,
    isAnalyzing,
    analysisProgress,
    fetchStatus,
    continueAnalysis,
  } = useAnalysisStatus(source);

  const pendingCount = status?.pending ?? 0;
  const shouldShowContinueButton = pendingCount > 0;

  // 初始加载时获取分析状态（挂载时执行一次）
  useEffect(() => {
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

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

    const result = await continueAnalysis(() => {
      // 分析完成，刷新精选数据
      refresh();
    });
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  };

  const handleBatchTranslate = async () => {
    setIsTranslatingBatch(true);
    setTranslateProgress(null);
    try {
      const res = await fetch('/api/arrivals/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch: true }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

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
              setTranslateProgress({ progress: 0, total: data.total, translated: 0 });
              continue;
            }

            if (data.progress !== undefined) {
              setTranslateProgress({ progress: data.progress, total: data.total, translated: data.translated });
              continue;
            }

            if (data.done) {
              toast.success(`补全翻译完成：${data.translated}/${data.total} 条`);
              fetchStatus();
            }
          } catch {}
        }
      }
    } catch (e) {
      toast.error('翻译请求失败');
    } finally {
      setIsTranslatingBatch(false);
      setTranslateProgress(null);
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
                {source === 'received' ? '🃏' : '💬'}
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{source === 'received' ? '收信精选' : '留言精选'}</h2>
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
                  title={`继续补全剩余 ${pendingCount} 条${source === 'received' ? '收信' : '留言'}的精选分析`}
                >
                  <TrendingUp className={`w-4 h-4 mr-1.5 ${isAnalyzing ? "animate-spin" : ""}`} />
                  {isAnalyzing ? "分析中..." : `继续分析 (${pendingCount})`}
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
              <h3 className="text-sm font-semibold text-gray-700 mb-3">📊 分析进度</h3>

              {analysisProgress && (
                <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  正在实时分析中，请勿关闭页面...
                </div>
              )}

              <div className="mb-3">
                {analysisProgress ? (
                  <>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600">
                        <Loader2 className="w-3 h-3 inline animate-spin text-orange-500 mr-1" />
                        {analysisProgress.phase === 'translating'
                          ? `翻译中 ${analysisProgress.translated ?? 0}/${analysisProgress.total}`
                          : `分析中 ${analysisProgress.analyzed}/${analysisProgress.total}`}
                        {analysisProgress.saved !== undefined && ` · 已保存 ${analysisProgress.saved}`}
                      </span>
                      <span className="text-gray-600">
                        {analysisProgress.phase === 'translating'
                          ? (analysisProgress.total > 0 ? `${(((analysisProgress.translated ?? 0) / analysisProgress.total) * 100).toFixed(0)}%` : '0%')
                          : (analysisProgress.total > 0 ? `${((analysisProgress.analyzed / analysisProgress.total) * 100).toFixed(0)}%` : '0%')}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          analysisProgress.phase === 'translating'
                            ? 'bg-gradient-to-r from-blue-500 to-indigo-500'
                            : 'bg-gradient-to-r from-orange-500 to-amber-500'
                        }`}
                        style={{
                          width: `${
                            analysisProgress.phase === 'translating'
                              ? (analysisProgress.total > 0 ? ((analysisProgress.translated ?? 0) / analysisProgress.total) * 100 : 0)
                              : (analysisProgress.total > 0 ? (analysisProgress.analyzed / analysisProgress.total) * 100 : 0)
                          }%`,
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <>
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
                  </>
                )}
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
                <div className="bg-white rounded p-2 text-center border border-slate-100 relative">
                  <div className="text-gray-500">有翻译</div>
                  <div className="font-bold text-purple-600">
                    {status.withTranslation} <span className="text-gray-400 font-normal">/ {status.total}</span>
                  </div>
                  {translateProgress ? (
                    <div className="mt-1">
                      <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                        <span>{translateProgress.progress}/{translateProgress.total}</span>
                        <span>{((translateProgress.progress / translateProgress.total) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-purple-500 h-full transition-all duration-300"
                          style={{ width: `${(translateProgress.progress / translateProgress.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    status.withTranslation < status.total && (
                      <button
                        onClick={handleBatchTranslate}
                        disabled={isTranslatingBatch}
                        className="mt-1 w-full text-xs text-purple-600 hover:text-purple-800 disabled:text-gray-400 transition-colors"
                      >
                        {isTranslatingBatch ? (
                          <span className="flex items-center justify-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            补全中...
                          </span>
                        ) : (
                          `补全 (${status.total - status.withTranslation})`
                        )}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* 低分提示 */}
              {status.scoreDistribution.poor > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  ℹ️ {status.scoreDistribution.poor} 条留言评分较低（&lt;40 分），可能需要优化评分规则
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 切换 */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {(source === 'received' ? RECEIVED_HIGHLIGHT_CATEGORIES : HIGHLIGHT_CATEGORIES).map((cat) => (
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
          {highlights.map((item: any, index: number) => (
            source === 'received' ? (
              <ReceivedHighlightCard key={item.id} item={item} index={index} />
            ) : (
              <HighlightsCard
                key={item.id}
                highlight={item}
                index={index}
              />
            )
          ))}
        </div>
      )}

      {/* 无数据状态 */}
      {!isLoading && !error && !emptyState && highlights.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>{source === 'received' ? '暂无收信精选，上传明信片并抽卡后可在此查看' : '暂无精选留言'}</p>
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

const RARITY_COLORS: Record<string, string> = {
  SSR: "from-yellow-400 to-amber-500",
  SR: "from-slate-300 to-slate-400",
  R: "from-orange-400 to-amber-500",
  N: "from-slate-400 to-slate-500",
};

const RARITY_BADGE_CLASS: Record<string, string> = {
  SSR: "bg-yellow-100 text-yellow-700 border-yellow-200",
  SR: "bg-slate-100 text-slate-600 border-slate-200",
  R: "bg-orange-100 text-orange-700 border-orange-200",
  N: "bg-gray-100 text-gray-600 border-gray-200",
};

const RARITY_ICON: Record<string, string> = {
  SSR: "👑",
  SR: "💎",
  R: "🔥",
  N: "📌",
};

/**
 * 收信精选卡片（样式与 arrivals HighlightsCard 统一）
 */
function ReceivedHighlightCard({ item, index }: { item: any; index: number }) {
  const [showDetail, setShowDetail] = useState(false);

  // 从 postcardId 前缀推断国家代码（当 country 为空或 UN 时）
  const effectiveCountry = (item.country && item.country !== 'UN')
    ? item.country
    : (item.postcardId?.match(/^([A-Z]{2})-/)?.[1] || item.country || '');
  const flagEmoji = getFlagEmoji(effectiveCountry);
  const text = item.ocrText || "";

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getRankColor = (idx: number) => {
    if (idx === 0) return "bg-gradient-to-br from-yellow-400 to-amber-500 text-white";
    if (idx === 1) return "bg-gradient-to-br from-gray-300 to-gray-400 text-white";
    if (idx === 2) return "bg-gradient-to-br from-orange-300 to-amber-400 text-white";
    return "bg-gray-100 text-gray-600";
  };

  const rarity = item.rarity || "N";

  return (
    <>
      <div
        onClick={() => setShowDetail(true)}
        className="
          group cursor-pointer
          bg-gradient-to-r from-white to-gray-50/50
          hover:shadow-lg hover:shadow-orange-500/10
          hover:-translate-y-0.5
          transition-all duration-300 ease-out
          border-l-4 border-orange-400 hover:border-orange-500
          overflow-hidden
          rounded-lg border border-gray-200
        "
      >
        <div className="p-4 sm:p-5">
          {/* 头部信息 */}
          <div className="flex items-start gap-3 mb-3">
            {/* 排名 */}
            <div
              className={`
                w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                ${getRankColor(index)}
              `}
            >
              {index + 1}
            </div>

            {/* 国家/发件人 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-2xl">{flagEmoji}</span>
                <span className="font-semibold text-gray-900 truncate">
                  {getCountryNameCN(effectiveCountry) || effectiveCountry || "未知"}
                </span>
                {item.senderUsername && (
                  <span className="text-sm text-gray-500">· {item.senderUsername}</span>
                )}
                {item.luckyReason && (
                  <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{item.luckyReason}</span>
                )}
              </div>
            </div>

            {/* AI 评分 */}
            {item.aiScore > 0 && (
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 text-xs font-semibold">
                  <Star className="w-3 h-3 fill-current" />
                  {item.aiScore}
                </div>
                {item.touchingScore != null && item.emotionalScore != null && item.culturalInsightScore != null && (
                  <div className="flex gap-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-pink-50 text-pink-600">💝{item.touchingScore}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">💗{item.emotionalScore}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">🌍{item.culturalInsightScore}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* OCR 文本预览 */}
          {text && (
            <div className="relative">
              <Quote className="absolute top-0 left-0 w-5 h-5 text-orange-200 -translate-x-1 -translate-y-1" />
              <p className="text-sm text-gray-600 line-clamp-3 pl-3 leading-relaxed italic">
                {text.length > 150 ? `${text.slice(0, 150)}...` : text}
              </p>
            </div>
          )}

          {/* 底部信息 */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-3 text-xs text-gray-500">
              {item.createdAt && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(item.createdAt)}
                </span>
              )}
              <span className="font-mono text-gray-400">{item.postcardId}</span>
            </div>

            {/* 稀有度标签 */}
            <span
              className={`
                inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full border
                ${RARITY_BADGE_CLASS[rarity] || RARITY_BADGE_CLASS.N}
              `}
            >
              {RARITY_ICON[rarity] || "📌"} {rarity}
            </span>
          </div>
        </div>
      </div>

      {/* 详情弹窗 */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">{flagEmoji}</span>
              <span>{getCountryNameCN(effectiveCountry) || effectiveCountry || "未知"}</span>
              {item.senderUsername && (
                <span className="text-sm font-normal text-gray-500">· {item.senderUsername}</span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* 评分和稀有度 */}
            <div className="flex items-center gap-3">
              {item.aiScore > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 text-sm font-semibold">
                  <Star className="w-4 h-4 fill-current" />
                  评分: {item.aiScore}
                </div>
              )}
              <span
                className={`
                  inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border
                  ${RARITY_BADGE_CLASS[rarity] || RARITY_BADGE_CLASS.N}
                `}
              >
                {RARITY_ICON[rarity] || "📌"} {rarity}
              </span>
              {item.luckyReason && (
                <span className="text-xs text-amber-600">{item.luckyReason}</span>
              )}
            </div>

            {/* 图片 */}
            {item.imageUrl && (
              <div className="rounded-lg overflow-hidden border border-gray-100">
                <img src={item.imageUrl} alt="" className="w-full object-cover max-h-60" />
              </div>
            )}

            {/* OCR 原文 */}
            {item.ocrText && (
              <div className="bg-gradient-to-r from-gray-50 to-orange-50/30 p-4 rounded-lg border border-gray-100">
                <Quote className="w-5 h-5 text-orange-300 mb-2" />
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed italic">
                  {item.ocrText}
                </p>
              </div>
            )}

            {/* 翻译 */}
            {item.translation && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50/30 p-4 rounded-lg border border-blue-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-blue-600">🇨🇳 中文翻译</span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {item.translation}
                </p>
              </div>
            )}

            {/* AI 评语 */}
            {item.summary && (
              <div className="bg-gradient-to-r from-purple-50 to-pink-50/30 p-4 rounded-lg border border-purple-100">
                <p className="text-xs font-medium text-purple-600 mb-2">🤖 AI 评语</p>
                <p className="text-sm text-gray-700 leading-relaxed">{item.summary}</p>
              </div>
            )}

            {/* 元数据 */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">明信片 ID</p>
                <p className="font-mono font-semibold text-gray-900">{item.postcardId}</p>
              </div>
              {item.createdAt && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">日期</p>
                  <p className="font-semibold text-gray-900">{formatDate(item.createdAt)}</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
