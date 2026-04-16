"use client";

import React from "react";
import {
  Mail,
  Rocket,
  Bot,
  MessageSquare,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
} from "lucide-react";

export type TimelineIconType =
  | "mail"
  | "rocket"
  | "bot"
  | "message"
  | "check"
  | "error"
  | "warning"
  | "clock";

export interface TimelineEvent {
  id: string;
  icon: TimelineIconType;
  title: string;
  description?: string;
  timestamp: Date | string;
  link?: string;
  linkLabel?: string;
  isLast?: boolean;
}

interface TimelineProps {
  events: TimelineEvent[];
  className?: string;
}

/**
 * 获取图标组件
 */
function getIconComponent(iconType: TimelineIconType): React.ReactNode {
  const iconClass = "h-5 w-5";

  switch (iconType) {
    case "mail":
      return <Mail className={iconClass} />;
    case "rocket":
      return <Rocket className={iconClass} />;
    case "bot":
      return <Bot className={iconClass} />;
    case "message":
      return <MessageSquare className={iconClass} />;
    case "check":
      return <CheckCircle className={iconClass} />;
    case "error":
      return <XCircle className={iconClass} />;
    case "warning":
      return <AlertCircle className={iconClass} />;
    case "clock":
      return <Clock className={iconClass} />;
    default:
      return <Clock className={iconClass} />;
  }
}

/**
 * 获取图标背景颜色
 */
function getIconBgColor(iconType: TimelineIconType): string {
  switch (iconType) {
    case "mail":
      return "bg-blue-100 text-blue-600";
    case "rocket":
      return "bg-purple-100 text-purple-600";
    case "bot":
      return "bg-emerald-100 text-emerald-600";
    case "message":
      return "bg-amber-100 text-amber-600";
    case "check":
      return "bg-green-100 text-green-600";
    case "error":
      return "bg-red-100 text-red-600";
    case "warning":
      return "bg-orange-100 text-orange-600";
    case "clock":
      return "bg-slate-100 text-slate-600";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

/**
 * 格式化时间
 */
function formatTimestamp(timestamp: Date | string): string {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * 垂直时间线组件
 */
export function Timeline({ events, className = "" }: TimelineProps) {
  // 按时间排序（新的在前面）
  const sortedEvents = [...events].sort((a, b) => {
    const dateA = new Date(a.timestamp).getTime();
    const dateB = new Date(b.timestamp).getTime();
    return dateB - dateA;
  });

  return (
    <div className={`relative ${className}`}>
      {sortedEvents.map((event, index) => {
        const IconComponent = getIconComponent(event.icon);
        const iconBgColor = getIconBgColor(event.icon);
        const isLast = index === sortedEvents.length - 1;

        return (
          <div
            key={event.id}
            className={`relative flex gap-4 ${isLast ? "" : "pb-8"}`}
          >
            {/* 时间线连接线 */}
            {!isLast && (
              <div className="absolute left-[22px] top-12 bottom-0 w-0.5 bg-slate-200" />
            )}

            {/* 图标 */}
            <div
              className={`flex-shrink-0 w-11 h-11 rounded-full ${iconBgColor} flex items-center justify-center shadow-sm`}
            >
              {IconComponent}
            </div>

            {/* 内容 */}
            <div className="flex-1 min-w-0 pt-1">
              {/* 时间和标题 */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-slate-500">
                  {formatTimestamp(event.timestamp)}
                </span>
                <span className="text-base font-semibold text-slate-800">
                  {event.title}
                </span>
              </div>

              {/* 描述 */}
              {event.description && (
                <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                  {event.description}
                </p>
              )}

              {/* 链接 */}
              {event.link && (
                <a
                  href={event.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {event.linkLabel || "查看详情"}
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * 示例数据
 */
export const sampleTimelineEvents: TimelineEvent[] = [
  {
    id: "1",
    icon: "mail",
    title: "收到用户邮件",
    description: "用户通过 teams@postwizard.cn 提交反馈",
    timestamp: "2026-03-30T23:14:00",
  },
  {
    id: "2",
    icon: "rocket",
    title: "推送到 GitHub Issue",
    description: "自动创建 GitHub Issue #1",
    timestamp: "2026-03-31T00:25:00",
    link: "https://github.com/arthurfsy2/PostWizard-lite/issues/1",
    linkLabel: "查看 Issue #1",
  },
  {
    id: "3",
    icon: "bot",
    title: "WorkBuddy 开始评估",
    description: "AI Agent 自动分析反馈内容并评估处理方案",
    timestamp: "2026-03-31T00:30:00",
  },
  {
    id: "4",
    icon: "message",
    title: "提交修复报告",
    description: "WorkBuddy 在 Issue 中提交处理报告和修复方案",
    timestamp: "2026-03-31T00:35:00",
    link: "https://github.com/arthurfsy2/PostWizard-lite/issues/1#comment-1",
    linkLabel: "查看评论",
  },
  {
    id: "5",
    icon: "check",
    title: "管理员确认处理",
    description: "管理员确认问题已解决，关闭 Issue",
    timestamp: "2026-03-31T00:40:00",
    isLast: true,
  },
];
