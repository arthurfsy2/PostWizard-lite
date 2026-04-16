"use client";

import { useState } from "react";
import { MapPin, Calendar, Quote, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { getFlagEmoji } from "@/lib/flag-emoji";
import type { HighlightItem, HighlightCategory } from "@/types/highlights";

interface HighlightsCardProps {
  highlight: HighlightItem;
  index: number;
}

/**
 * 留言精选卡片组件
 * 展示单条精选留言
 */
export function HighlightsCard({ highlight, index }: HighlightsCardProps) {
  const [showDetail, setShowDetail] = useState(false);

  const flagEmoji = getFlagEmoji(highlight.country);
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getCategoryLabel = (category: HighlightCategory) => {
    const labels: Record<HighlightCategory, string> = {
      touching: "最走心",
      funny: "最有趣",
      blessing: "最祝福",
      cultural: "文化交流",
    };
    return labels[category];
  };

  const getCategoryColor = (category: HighlightCategory) => {
    const colors: Record<HighlightCategory, string> = {
      touching: "bg-pink-100 text-pink-700 border-pink-200",
      funny: "bg-amber-100 text-amber-700 border-amber-200",
      blessing: "bg-emerald-100 text-emerald-700 border-emerald-200",
      cultural: "bg-blue-100 text-blue-700 border-blue-200",
    };
    return colors[category];
  };

  const getCategoryIcon = (category: HighlightCategory) => {
    const icons: Record<HighlightCategory, string> = {
      touching: "💝",
      funny: "😄",
      blessing: "✨",
      cultural: "🌍",
    };
    return icons[category];
  };

  // 计算排名颜色
  const getRankColor = (idx: number) => {
    if (idx === 0) return "bg-gradient-to-br from-yellow-400 to-amber-500 text-white";
    if (idx === 1) return "bg-gradient-to-br from-gray-300 to-gray-400 text-white";
    if (idx === 2) return "bg-gradient-to-br from-orange-300 to-amber-400 text-white";
    return "bg-gray-100 text-gray-600";
  };

  return (
    <>
      {/* 卡片 */}
      <Card
        onClick={() => setShowDetail(true)}
        className="
          group cursor-pointer
          bg-gradient-to-r from-white to-gray-50/50
          hover:shadow-lg hover:shadow-orange-500/10
          hover:-translate-y-0.5
          transition-all duration-300 ease-out
          border-l-4 border-orange-400 hover:border-orange-500
          overflow-hidden
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
                  {highlight.country}
                </span>
                {highlight.sender && (
                  <span className="text-sm text-gray-500">· {highlight.sender}</span>
                )}
              </div>
            </div>

            {/* AI 评分 */}
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 text-xs font-semibold">
              <Star className="w-3 h-3 fill-current" />
              {highlight.aiScore}
            </div>
          </div>

          {/* 留言内容 - 预览 */}
          <div className="relative">
            <Quote className="absolute top-0 left-0 w-5 h-5 text-orange-200 -translate-x-1 -translate-y-1" />
            <p className="text-sm text-gray-600 line-clamp-3 pl-3 leading-relaxed italic">
              {highlight.message.length > 150
                ? `${highlight.message.slice(0, 150)}...`
                : highlight.message}
            </p>
          </div>

          {/* 底部信息 */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(highlight.arrivalDate)}
              </span>
              <span className="font-mono text-gray-400">{highlight.postcardId}</span>
            </div>

            {/* 分类标签 */}
            <Badge
              variant="outline"
              className={`
                text-xs font-medium
                ${getCategoryColor(highlight.primaryCategory)}
              `}
            >
              <span className="mr-1">{getCategoryIcon(highlight.primaryCategory)}</span>
              {getCategoryLabel(highlight.primaryCategory)}
            </Badge>
          </div>

          {/* 关键词标签 */}
          {highlight.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {highlight.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="
                    text-xs px-2 py-0.5 rounded-full
                    bg-gray-100 text-gray-600
                    group-hover:bg-orange-50 group-hover:text-orange-600
                    transition-colors
                  "
                >
                  #{tag}
                </span>
              ))}
              {highlight.tags.length > 4 && (
                <span className="text-xs px-2 py-0.5 text-gray-400">
                  +{highlight.tags.length - 4}
                </span>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* 详情弹窗 */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">{flagEmoji}</span>
              <span>{highlight.country}</span>
              {highlight.sender && (
                <span className="text-sm font-normal text-gray-500">· {highlight.sender}</span>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* 详情内容 */}
          <div className="space-y-4">
            {/* 评分和分类 */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 text-sm font-semibold">
                <Star className="w-4 h-4 fill-current" />
                AI 评分: {highlight.aiScore}
              </div>
              <Badge
                variant="outline"
                className={`${getCategoryColor(highlight.primaryCategory)}`}
              >
                {getCategoryIcon(highlight.primaryCategory)}
                {getCategoryLabel(highlight.primaryCategory)}
              </Badge>
            </div>

            {/* 完整留言 */}
            <div className="bg-gradient-to-r from-gray-50 to-orange-50/30 p-4 rounded-lg border border-gray-100">
              <Quote className="w-5 h-5 text-orange-300 mb-2" />
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed italic">
                {highlight.message}
              </p>
            </div>

            {/* 中文翻译（如果有） */}
            {highlight.translation && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50/30 p-4 rounded-lg border border-blue-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-blue-600">🇨🇳 中文翻译</span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {highlight.translation}
                </p>
              </div>
            )}

            {/* 其他分类评分 */}
            {highlight.categories.length > 1 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 font-medium">分类置信度</p>
                <div className="flex flex-wrap gap-2">
                  {highlight.categories
                    .filter((c) => c.name !== highlight.primaryCategory)
                    .slice(0, 3)
                    .map((cat) => (
                      <span
                        key={cat.name}
                        className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600"
                      >
                        {getCategoryLabel(cat.name)}: {cat.confidence}%
                      </span>
                    ))}
                </div>
              </div>
            )}

            {/* 元数据 */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">明信片 ID</p>
                <p className="font-mono font-semibold text-gray-900">{highlight.postcardId}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">到达日期</p>
                <p className="font-semibold text-gray-900">{formatDate(highlight.arrivalDate)}</p>
              </div>
            </div>

            {/* 关键词 */}
            {highlight.tags.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 font-medium mb-2">关键词标签</p>
                <div className="flex flex-wrap gap-2">
                  {highlight.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2.5 py-1 rounded-full bg-orange-100 text-orange-700"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 情感倾向 */}
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>情感倾向:</span>
              <span
                className={`
                  px-2 py-0.5 rounded-full font-medium
                  ${
                    highlight.emotion === "positive"
                      ? "bg-emerald-100 text-emerald-700"
                      : highlight.emotion === "negative"
                      ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-600"
                  }
                `}
              >
                {highlight.emotion === "positive"
                  ? "😊 积极"
                  : highlight.emotion === "negative"
                  ? "😔 消极"
                  : "😐 中性"}
              </span>
            </div>

            {/* 分析时间 */}
            <p className="text-xs text-gray-400 text-right">
              分析于 {formatDate(highlight.analyzedAt)}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
