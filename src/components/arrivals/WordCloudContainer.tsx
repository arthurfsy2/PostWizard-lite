"use client";

import { WordCloud } from "./WordCloud";
import { WordCloudEnhanced } from "./WordCloudEnhanced";
import { LanguageSwitch } from "./LanguageSwitch";
import { useWordCloud } from "@/hooks/useWordCloud";
import { useState, useRef, useEffect, useCallback } from "react";
import { WordCloudWord } from "@/types/wordcloud";
import { cn } from "@/lib/utils";
import { BarChart3, RefreshCw, Palette } from "lucide-react";

/**
 * 词云容器组件
 *
 * 包含词云展示和语言切换功能
 * - 单击：带防抖的普通刷新（10 秒内不重复请求）
 * - 长按 0.8 秒：强制刷新（绕过缓存，直接读数据库）
 */
export function WordCloudContainer({ source = 'arrivals' }: { source?: 'arrivals' | 'received' }) {
  const [language, setLanguage] = useState<"zh" | "en" | "all">("en");
  const [forceRefresh, setForceRefresh] = useState(false);
  const [isLongPress, setIsLongPress] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [useEnhanced, setUseEnhanced] = useState(true); // 默认使用增强版

  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const cooldownTimer = useRef<NodeJS.Timeout | null>(null);
  const lastClickTime = useRef(0);

  const { data, error, isLoading, refresh } = useWordCloud(
    language,
    forceRefresh,
    source,
  );

  const handleWordClick = (word: WordCloudWord) => {
    console.log("Clicked word:", word);
  };

  // 防抖刷新（普通单击）
  const handleRefresh = useCallback(() => {
    const now = Date.now();
    const COOLDOWN_MS = 10000; // 10 秒防抖

    if (now - lastClickTime.current < COOLDOWN_MS) {
      // 防抖中，显示剩余时间
      const remaining = Math.ceil(
        (COOLDOWN_MS - (now - lastClickTime.current)) / 1000,
      );
      setCooldownLeft(remaining);
      if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
      cooldownTimer.current = setTimeout(
        () => setCooldownLeft(0),
        remaining * 1000,
      );
      return;
    }

    lastClickTime.current = now;
    setCooldownLeft(0);
    refresh();
  }, [refresh]);

  // 处理长按 - 强制刷新（绕过缓存）
  const handleMouseDown = () => {
    setIsLongPress(false);
    longPressTimer.current = setTimeout(() => {
      setIsLongPress(true);
      setForceRefresh(true);
      lastClickTime.current = Date.now(); // 重置防抖计时
    }, 800); // 0.8 秒长按触发强制刷新
  };

  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleClick = () => {
    if (isLongPress) {
      // 长按释放：执行强制刷新
      refresh();
    } else {
      // 短按：执行带防抖的普通刷新
      handleRefresh();
    }
    // 重置状态
    setForceRefresh(false);
    setIsLongPress(false);
  };

  // 清理定时器
  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
    };
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-lg shadow-slate-900/5 overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-md">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              词云分析
            </h3>
            {data && (
              <p className="text-xs text-slate-500">
                基于 {data.totalMessages} 条{source === 'received' ? '收信' : '明信片'} / 共计 {data.totalWords} 字{source === 'received' ? '手写内容' : '留言'}，提取了 {data.uniqueWords} 个关键词
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <LanguageSwitch value={language} onChange={setLanguage} />
          
          {/* 版本切换按钮 */}
          <button
            onClick={() => setUseEnhanced(!useEnhanced)}
            className={cn(
              "px-2.5 py-1.5 text-xs rounded-lg transition-all duration-300 border flex items-center gap-1.5",
              useEnhanced
                ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white border-transparent shadow-md"
                : "bg-white text-slate-600 border-slate-200 hover:border-purple-300"
            )}
            title={useEnhanced ? "切换到经典版" : "切换到增强版"}
          >
            {useEnhanced ? (
              <>
                <Palette className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">增强版</span>
              </>
            ) : (
              <>
                <BarChart3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">经典版</span>
              </>
            )}
          </button>
          
          <div className="relative">
            <button
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleMouseDown}
              onTouchEnd={handleMouseUp}
              onClick={handleClick}
              disabled={cooldownLeft > 0 && !isLongPress}
              className={`p-2 transition-colors ${
                cooldownLeft > 0
                  ? "text-slate-300 cursor-not-allowed"
                  : isLongPress
                    ? "text-orange-500"
                    : "text-slate-400 hover:text-slate-600"
              }`}
              title={
                cooldownLeft > 0
                  ? `防抖中，请 ${cooldownLeft} 秒后重试`
                  : "刷新（长按 0.8 秒强制重新生成）"
              }
            >
              <RefreshCw
                className={`w-5 h-5 ${forceRefresh || isLoading ? "animate-spin" : ""}`}
              />
            </button>
            {/* 防抖倒计时提示 */}
            {cooldownLeft > 0 && !isLongPress && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-slate-400 text-white text-xs rounded-full flex items-center justify-center">
                {cooldownLeft}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 词云展示区域 */}
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full min-h-[400px]">
            <div className="flex items-center gap-3 text-slate-400">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-sm">加载中...</span>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-slate-500">
            <svg
              className="w-12 h-12 mb-3 text-slate-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p className="text-sm mb-2">加载失败</p>
            <button
              onClick={() => refresh()}
              className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl text-sm font-medium hover:shadow-lg transition-all duration-300"
            >
              重试
            </button>
          </div>
        ) : data ? (
          <div className="p-4">
            {useEnhanced ? (
              <WordCloudEnhanced
                data={data}
                onWordClick={handleWordClick}
                showExport={true}
              />
            ) : (
              <div className="flex items-center justify-center">
                <WordCloud
                  data={data}
                  width={900}
                  height={500}
                  onWordClick={handleWordClick}
                />
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
