"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { useAuth } from "@/hooks/useAuth";
import { ArrivalCard } from "@/components/arrivals/ArrivalCard";
import { ArrivalSearchDialog } from "@/components/arrivals/ArrivalSearchDialog";
import { useArrivalsList } from "@/hooks/useArrivals";
import { useEmailConfigs } from "@/hooks/useApi";
import { apiFetch } from '@/lib/fetch';
import { WordCloudContainer } from "@/components/arrivals/WordCloudContainer";
import { HighlightsContainer } from "@/components/arrivals/HighlightsContainer";
import { FallbackScoreNotice } from "@/components/arrivals/FallbackScoreNotice";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Mail,
  Check,
  AlertCircle,
  Search,
  List,
  Cloud,
  MessageSquare,
  Compass,

  ChevronLeft,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface GlobalStats {
  total: number;
  emailTotalCount: number;
  avgTravelDays?: number;
  byCountry: { country: string; count: number; code?: string }[];
}

type TabType = "timeline" | "wordcloud" | "highlights";

function TabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}) {
  const tabs = [
    { id: "timeline" as TabType, icon: List, label: "Timeline" },
    { id: "wordcloud" as TabType, icon: Cloud, label: "词云" },
    { id: "highlights" as TabType, icon: MessageSquare, label: "精选" },
  ];

  return (
    <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex gap-2 py-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "relative flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-300",
                activeTab === tab.id
                  ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/20"
                  : "bg-white/70 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              )}
            >
              <tab.icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function OnboardingGuide({ onStartSearch }: { onStartSearch: () => void }) {
  const steps = [
    { icon: Mail, title: "配置邮箱", desc: "添加你的 Postcrossing 邮箱" },
    { icon: Search, title: "搜索邮件", desc: "扫描邮箱中的送达确认" },
    { icon: Compass, title: "开始探索", desc: "查看词云、精选和 Timeline" },
  ];

  return (
    <div className="my-4 overflow-hidden rounded-[28px] border border-white/70 bg-white/90 shadow-xl shadow-slate-900/5">
      <div className="bg-gradient-to-r from-orange-500/8 via-amber-500/6 to-emerald-500/8 px-6 py-6 sm:px-8">
        <h3 className="text-center text-xl font-bold text-slate-900">欢迎使用送达回复功能</h3>
        <p className="mt-2 text-center text-sm leading-7 text-slate-500">
          从邮箱中找回那些“明信片安全送达”的温暖回信，把旅程和回复整理成一条清晰的时间线。
        </p>
      </div>

      <div className="grid gap-4 px-6 py-6 sm:grid-cols-3 sm:px-8">
        {steps.map((step, i) => (
          <div key={i} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/20">
              <step.icon className="h-6 w-6 text-white" />
            </div>
            <div className="text-sm font-semibold text-slate-900">{step.title}</div>
            <div className="mt-1 text-xs leading-6 text-slate-500">{step.desc}</div>
          </div>
        ))}
      </div>

      <div className="px-6 pb-6 sm:px-8">
        <Button
          onClick={onStartSearch}
          className="h-12 w-full rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-base font-semibold shadow-lg shadow-orange-500/25 hover:from-orange-600 hover:to-amber-600"
          size="lg"
        >
          <Search className="mr-2 h-4 w-4" />
          开始搜索邮件
        </Button>
      </div>
    </div>
  );
}

function TimelineTab({
  arrivals,
  pagination,
  isLoading,
  globalStats,
  selectedCountry,
  onCountryChange,
  page,
  onPageChange,
  onStartSearch,
}: {
  arrivals: any[];
  pagination: any;
  isLoading: boolean;
  globalStats: GlobalStats | null;
  selectedCountry: string | null;
  onCountryChange: (country: string | null) => void;
  page: number;
  onPageChange: (page: number) => void;
  onStartSearch: () => void;
}) {
  const hasData = arrivals.length > 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {!isLoading && hasData && (
        <div className="mb-5 overflow-hidden rounded-[26px] border border-white/70 bg-white/85 p-4 shadow-lg shadow-slate-900/5 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">国家筛选</div>
              <div className="text-xs text-slate-500">按寄达国家筛选你的送达回复时间线</div>
            </div>
            {selectedCountry && (
              <button
                onClick={() => onCountryChange(null)}
                className="text-xs font-medium text-orange-600 hover:text-orange-700"
              >
                清除筛选
              </button>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => onCountryChange(null)}
              className={cn(
                "flex-shrink-0 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-all duration-300",
                !selectedCountry
                  ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:text-orange-600"
              )}
            >
              全部
              <span className={cn("ml-1", !selectedCountry ? "text-white/80" : "text-slate-400")}>
                ({globalStats?.total || 0})
              </span>
            </button>

            {globalStats?.byCountry?.map((c) => (
              <button
                key={c.code || c.country}
                onClick={() => onCountryChange(c.code || c.country)}
                className={cn(
                  "flex-shrink-0 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-all duration-300",
                  selectedCountry === (c.code || c.country)
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:text-orange-600"
                )}
              >
                {c.code || c.country}
                <span className={cn("ml-1", selectedCountry === (c.code || c.country) ? "text-white/80" : "text-slate-400")}>
                  ({c.count})
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="flex items-center gap-3 rounded-full border border-orange-100 bg-white px-5 py-3 text-sm text-slate-500 shadow-lg shadow-orange-500/10">
            <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
            正在整理你的送达时间线...
          </div>
        </div>
      )}

      {!isLoading && !hasData && <OnboardingGuide onStartSearch={onStartSearch} />}

      {!isLoading && hasData && (
        <div className="overflow-hidden rounded-[32px] border border-white/70 bg-white/72 shadow-2xl shadow-slate-900/5 backdrop-blur-sm">
          <div className="border-b border-slate-100 bg-gradient-to-r from-orange-500/8 via-white to-amber-500/8 px-5 py-5 sm:px-8">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">
                  <Mail className="h-3.5 w-3.5" />
                  Arrivals Timeline
                </div>
                <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  按送达顺序展开的世界回信时间线
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500 sm:text-[15px]">
                  从你寄出明信片开始，到对方收到并回信，这里按时间顺序保留每一段抵达的痕迹。点击任意卡片可查看完整留言内容。
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-orange-100 bg-white/90 px-4 py-3 shadow-sm shadow-orange-500/10">
                  <div className="text-xs font-medium text-slate-500">当前记录</div>
                  <div className="mt-1 text-xl font-bold text-slate-900">{globalStats?.total || 0}</div>
                </div>
                <div className="rounded-2xl border border-amber-100 bg-white/90 px-4 py-3 shadow-sm shadow-amber-500/10">
                  <div className="text-xs font-medium text-slate-500">平均旅途</div>
                  <div className="mt-1 text-xl font-bold text-slate-900">
                    {globalStats?.avgTravelDays ? `${globalStats.avgTravelDays.toFixed(1)} 天` : "-"}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm shadow-slate-500/5 col-span-2 sm:col-span-1">
                  <div className="text-xs font-medium text-slate-500">覆盖国家</div>
                  <div className="mt-1 text-xl font-bold text-slate-900">{globalStats?.byCountry?.length || 0}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            <div className="pointer-events-none absolute left-[30px] top-8 bottom-8 hidden w-[3px] rounded-full bg-gradient-to-b from-orange-500 via-amber-400 to-emerald-400 shadow-[0_0_0_8px_rgba(245,158,11,0.08)] md:block lg:left-[38px]" />

            <div className="space-y-5 lg:space-y-6">
              {arrivals.map((a) => (
                <div key={a.id} className="relative">
                  <ArrivalCard
                    arrival={a}
                    onDelete={() => {
                      window.dispatchEvent(new CustomEvent("refresh-arrivals"));
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
            className="gap-1 rounded-full border-slate-200 bg-white/90 px-4"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">上一页</span>
          </Button>

          <div className="flex items-center gap-2 rounded-full border border-orange-100 bg-white px-4 py-2 text-sm shadow-sm shadow-orange-500/10">
            <span className="rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-1 font-semibold text-white">
              {page}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-slate-300" />
            <span className="text-slate-500">共 {pagination.totalPages} 页</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            disabled={page >= pagination.totalPages}
            onClick={() => onPageChange(page + 1)}
            className="gap-1 rounded-full border-slate-200 bg-white/90 px-4"
          >
            <span className="hidden sm:inline">下一页</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function EmptyTabContent({ type, title }: { type: "timeline" | "wordcloud" | "highlights"; title: string }) {
  const iconConfig = {
    timeline: List,
    wordcloud: Cloud,
    highlights: MessageSquare,
  };
  const Icon = iconConfig[type];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-[28px] border border-white/70 bg-white/90 p-8 text-center shadow-xl shadow-slate-900/5">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-slate-100 to-slate-50 shadow-inner">
          <Icon className="h-8 w-8 text-slate-400" />
        </div>
        <h3 className="mb-2 text-lg font-bold text-slate-900">暂无 {title}</h3>
        <p className="mb-4 text-sm text-slate-500">解析更多邮件后，这里会展示你的 {title}</p>
        <div className="inline-flex items-center gap-2 text-sm text-slate-400">
          <List className="h-4 w-4" />
          <span>切换到 Timeline 开始解析邮件</span>
        </div>
      </div>
    </div>
  );
}

export default function ArrivalsPage() {
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<TabType>("timeline");
  const { isLoading: authLoading, isAuthenticated } = useAuth();

  const { arrivals, pagination, isLoading, fetchArrivals } = useArrivalsList();
  const { data: emailConfigs } = useEmailConfigs();

  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);

  const [searchStats, setSearchStats] = useState<{
    total: number;
    parsed: number;
    pending: number;
  } | null>(null);

  const hasData = (globalStats?.total || 0) > 0 || arrivals.length > 0;

  const hasEmailConfig = emailConfigs && emailConfigs.length > 0;
  const currentEmailConfig = emailConfigs?.[0];

  const refreshStats = useCallback(async () => {
    try {
      const response = await apiFetch("/api/arrivals?page=1&limit=1");
      const result = await response.json();
      if (result.success) {
        setGlobalStats(result.data.stats);
      }
    } catch (err) {
      console.error("Failed to fetch global stats:", err);
    }
  }, []);

  // 开源版：本地模式无需认证检查，直接加载数据
  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  useEffect(() => {
    const handleRefresh = () => {
      refreshStats();
      fetchArrivals({ page, country: selectedCountry || undefined });
    };
    window.addEventListener("refresh-arrivals", handleRefresh);
    return () => window.removeEventListener("refresh-arrivals", handleRefresh);
  }, [page, selectedCountry, fetchArrivals, refreshStats]);

  useEffect(() => {
    if (activeTab === "timeline") {
      fetchArrivals({ page, country: selectedCountry || undefined });
    }
  }, [page, selectedCountry, activeTab, fetchArrivals]);

  if (authLoading) return <PageLoadingSpinner />;
  // 开源版：本地模式无需认证检查

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-50 via-white to-orange-50/30">
      <Header />

      <div className="border-b border-white/70 bg-white/82 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/25">
                <Mail className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">送达回复时间线</h1>
                <p className="text-xs text-slate-500">按时间顺序整理明信片送达后的回信</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {hasEmailConfig ? (
                <div className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 shadow-sm sm:flex sm:items-center sm:gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  {currentEmailConfig?.email}
                </div>
              ) : (
                <div className="hidden rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm sm:flex sm:items-center sm:gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                  未配置邮箱
                </div>
              )}

              <Button
                onClick={() => setShowSearchDialog(true)}
                className="h-9 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 text-sm shadow-lg shadow-orange-500/25 hover:from-orange-600 hover:to-amber-600"
              >
                <Search className="mr-1.5 h-3.5 w-3.5" />
                搜索邮件
              </Button>
            </div>
          </div>
        </div>
      </div>

      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1">
        {activeTab === "timeline" && (
          <TimelineTab
            arrivals={arrivals}
            pagination={pagination}
            isLoading={isLoading}
            globalStats={globalStats}
            selectedCountry={selectedCountry}
            onCountryChange={(country) => {
              setSelectedCountry(country);
              setPage(1);
            }}
            page={page}
            onPageChange={setPage}
            onStartSearch={() => setShowSearchDialog(true)}
          />
        )}

        {activeTab === "wordcloud" &&
          (hasData ? (
            <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
              <WordCloudContainer />
            </div>
          ) : (
            <EmptyTabContent type="wordcloud" title="词云" />
          ))}

        {activeTab === "highlights" &&
          (hasData ? (
            <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
              <div className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-xl shadow-slate-900/5">
                <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
                  <MessageSquare className="h-5 w-5" /> 留言精选
                </h3>
                <FallbackScoreNotice />
                <HighlightsContainer limit={20} />
              </div>
            </div>
          ) : (
            <EmptyTabContent type="highlights" title="留言精选" />
          ))}
      </div>

      <Footer />

      <ArrivalSearchDialog
        open={showSearchDialog}
        onOpenChange={setShowSearchDialog}
        onComplete={async () => {
          await refreshStats();
          fetchArrivals({ page, country: selectedCountry || undefined });
        }}
        onSearchStats={setSearchStats}
      />
    </div>
  );
}

