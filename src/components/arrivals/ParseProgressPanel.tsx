"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

export interface ParseProgressState {
  progress: number;
  success: number;
  failed: number;
  skipped: number;
  current: number;
  total: number;
}

export interface ParseLogEntry {
  type: "info" | "success" | "warning" | "error";
  message: string;
}

interface ParseProgressPanelProps {
  title: string;
  subtitle?: string;
  progress: ParseProgressState | null;
  logs: ParseLogEntry[];
  isParsing: boolean;
  emptyText?: string;
}

export function ParseProgressPanel({
  title,
  subtitle,
  progress,
  logs,
  isParsing,
  emptyText = "等待解析日志...",
}: ParseProgressPanelProps) {
  const hasProgress = progress && progress.total > 0;

  return (
    <div className="space-y-3 pt-3 border-t">
      <div className="rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-gray-900">{title}</div>
            {subtitle ? (
              <div className="mt-1 text-xs text-gray-600">{subtitle}</div>
            ) : null}
          </div>
          {isParsing ? (
            <div className="flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs text-orange-700 shadow-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              解析进行中
            </div>
          ) : null}
        </div>

        {hasProgress ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">解析进度</span>
              <span className="font-semibold text-gray-900">
                {progress.current}/{progress.total}
              </span>
            </div>

            <Progress value={progress.progress} className="gap-2">
              <div className="w-full rounded-full bg-white/80 p-1 shadow-inner">
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-orange-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all"
                    style={{ width: `${progress.progress}%` }}
                  />
                </div>
              </div>
            </Progress>

            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="rounded-lg bg-white px-2 py-2 text-gray-600 shadow-sm">
                <div className="text-[11px] text-gray-500">总计</div>
                <div className="mt-1 text-sm font-semibold text-gray-900">
                  {progress.total}
                </div>
              </div>
              <div className="rounded-lg bg-white px-2 py-2 text-emerald-600 shadow-sm">
                <div className="text-[11px] text-emerald-500">成功</div>
                <div className="mt-1 text-sm font-semibold">{progress.success}</div>
              </div>
              <div className="rounded-lg bg-white px-2 py-2 text-red-500 shadow-sm">
                <div className="text-[11px] text-red-400">失败</div>
                <div className="mt-1 text-sm font-semibold">{progress.failed}</div>
              </div>
              <div className="rounded-lg bg-white px-2 py-2 text-amber-600 shadow-sm">
                <div className="text-[11px] text-amber-500">跳过</div>
                <div className="mt-1 text-sm font-semibold">{progress.skipped}</div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="max-h-[220px] space-y-1 overflow-y-auto rounded-lg border bg-gray-50 p-3">
        {logs.length > 0 ? (
          logs.map((log, index) => (
            <div
              key={`${log.type}-${index}-${log.message}`}
              className={cn(
                "text-sm leading-6",
                log.type === "error"
                  ? "text-red-600"
                  : log.type === "success"
                    ? "text-emerald-600"
                    : log.type === "warning"
                      ? "text-amber-600"
                      : "text-gray-600"
              )}
            >
              {log.message}
            </div>
          ))
        ) : (
          <div className="text-sm text-gray-400">{emptyText}</div>
        )}
      </div>
    </div>
  );
}
