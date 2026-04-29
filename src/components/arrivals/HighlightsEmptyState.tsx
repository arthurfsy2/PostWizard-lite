"use client";

import { Button } from "@/components/ui/button";
import { HIGHLIGHT_CATEGORIES, type HighlightCategory, type HighlightsEmptyState } from "@/types/highlights";

interface HighlightsEmptyStateProps {
  category: HighlightCategory;
  emptyState: HighlightsEmptyState;
}

/**
 * 留言精选空状态组件
 * 展示不同情况下的空状态提示
 */
export function HighlightsEmptyState({ category, emptyState }: HighlightsEmptyStateProps) {
  const getCategoryInfo = (cat: HighlightCategory) => {
    return HIGHLIGHT_CATEGORIES.find((c) => c.key === cat);
  };

  const categoryInfo = getCategoryInfo(category);

  const getEmptyMessage = () => {
    switch (emptyState.type) {
      case "insufficient_data":
        return (
          <div className="space-y-3">
            <p className="text-gray-900 font-medium">数据还不够哦~</p>
            <p className="text-gray-500 text-sm leading-relaxed">
              收到更多明信片后，系统会帮你挑选最动人的留言
            </p>
          </div>
        );
      case "low_score":
        return (
          <div className="space-y-3">
            <p className="text-gray-900 font-medium">还没有特别{categoryInfo?.label?.replace("最", "") || "精选"}的留言</p>
            <p className="text-gray-500 text-sm leading-relaxed">
              期待下一张明信片带来更多惊喜！
            </p>
          </div>
        );
      case "no_messages":
        return (
          <div className="space-y-3">
            <p className="text-gray-900 font-medium">还没有任何留言</p>
            <p className="text-gray-500 text-sm leading-relaxed">
              从邮箱中解析送达确认邮件后，系统会自动分析留言
            </p>
          </div>
        );
      default:
        return (
          <div className="space-y-3">
            <p className="text-gray-900 font-medium">暂无数据</p>
            <p className="text-gray-500 text-sm leading-relaxed">
              {emptyState.message}
            </p>
          </div>
        );
    }
  };

  const getEmptyIcon = () => {
    switch (emptyState.type) {
      case "insufficient_data":
        return "📊";
      case "low_score":
        return "💭";
      case "no_messages":
        return "📭";
      default:
        return "📝";
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {/* 图标 */}
      <div className="text-6xl mb-6 opacity-80">{getEmptyIcon()}</div>

      {/* 消息 */}
      <div className="max-w-xs">{getEmptyMessage()}</div>

      {/* 分类专属提示 */}
      <div className="mt-6 p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-100 max-w-xs">
        <p className="text-xs text-orange-600 font-medium mb-1">
          💡 {categoryInfo?.label} 小贴士
        </p>
        <p className="text-xs text-gray-500">{categoryInfo?.description}</p>
      </div>

      {/* 操作按钮 */}
      {emptyState.action && (
        <Button
          className="mt-6 bg-gradient-to-r from-orange-500 to-amber-500 hover:shadow-lg"
          onClick={() => {
            if (emptyState.action?.href) {
              window.location.href = emptyState.action.href;
            }
          }}
        >
          {emptyState.action.text}
        </Button>
      )}
    </div>
  );
}
