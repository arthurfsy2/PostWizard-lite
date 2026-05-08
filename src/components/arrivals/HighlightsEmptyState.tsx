"use client";

import { useTranslations } from 'next-intl';
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
  const t = useTranslations('Highlights');
  const getCategoryInfo = (cat: HighlightCategory) => {
    return HIGHLIGHT_CATEGORIES.find((c) => c.key === cat);
  };

  const categoryInfo = getCategoryInfo(category);

  const getEmptyMessage = () => {
    switch (emptyState.type) {
      case "insufficient_data":
        return (
          <div className="space-y-3">
            <p className="text-gray-900 font-medium">{t('insufficientData')}</p>
            <p className="text-gray-500 text-sm leading-relaxed">
              {t('insufficientDataDesc')}
            </p>
          </div>
        );
      case "low_score":
        return (
          <div className="space-y-3">
            <p className="text-gray-900 font-medium">{t('lowScoreTitle', { category: categoryInfo?.label?.replace("最", "") || "" })}</p>
            <p className="text-gray-500 text-sm leading-relaxed">
              {t('lowScoreDesc')}
            </p>
          </div>
        );
      case "no_messages":
        return (
          <div className="space-y-3">
            <p className="text-gray-900 font-medium">{t('noMessages')}</p>
            <p className="text-gray-500 text-sm leading-relaxed">
              {t('noMessagesDesc')}
            </p>
          </div>
        );
      default:
        return (
          <div className="space-y-3">
            <p className="text-gray-900 font-medium">{t('noData')}</p>
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
          {t('tip', { label: categoryInfo?.label })}
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
