'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/hooks/useAuth';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ExportDialog, ExportOptions } from '@/components/export/ExportDialog';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Loader2,
  Search,
  Calendar,
  MapPin,
  User,
  Eye,
  FileText,
  Download,
  Printer,
  CheckSquare,
  Square,
  Star,
  Globe2,
  Filter,
  RefreshCcw,
  ChevronRight,
  PenTool,
} from 'lucide-react';

interface HistoryItem {
  id: string;
  contentTitle: string;
  contentBody: string;
  contentType: string;
  tone?: string;
  language: string;
  isFavorite: boolean;
  isHandwritten: boolean;
  wordCount?: number;
  createdAt: string;
  updatedAt: string;
  postcardId?: string | null;
  recipient: {
    id: string;
    name: string;
    country: string;
    city: string;
    status: string;
  } | null;
}

interface HistoryResponse {
  success: boolean;
  data?: {
    items: HistoryItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  error?: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const { isLoading, isAuthenticated, token } = useAuth();
  const [history, setHistory] = useState<HistoryItem[]>([]);


  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // 筛选条件
  const [country, setCountry] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searching, setSearching] = useState(false);

  // 多选状态
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectAll, setIsSelectAll] = useState(false);

  // 导出对话框
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const fetchHistory = async () => {
    setSearching(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '20');
      if (country) params.set('country', country);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const response = await fetch(`/api/history?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data: HistoryResponse = await response.json();

      if (data.success && data.data) {
        setHistory(data.data.items);
        setTotalPages(data.data.pagination.totalPages);
        setTotal(data.data.pagination.total);
        // 清除选择（换页时）
        setSelectedIds(new Set());
        setIsSelectAll(false);
      } else {
        setError(data.error || '获取历史记录失败');
      }
    } catch (err) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
      setSearching(false);
    }
  };

  useEffect(() => {
    // 等待 token 加载完成再发起请求
    if (!isLoading && token) {
      fetchHistory();
    }
  }, [page, token, isLoading]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchHistory();
  };

  const handleReset = () => {
    setCountry('');
    setStartDate('');
    setEndDate('');
    setPage(1);
    setLoading(true);
    fetchHistory();
  };

  // 多选功能
  const handleSelectAll = () => {
    if (isSelectAll) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(history.map(item => item.id)));
    }
    setIsSelectAll(!isSelectAll);
  };

  const handleSelectItem = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
    setIsSelectAll(newSelected.size === history.length);
  };

  // 批量导出
  const handleExport = async (options: ExportOptions) => {
    if (selectedIds.size === 0) return;

    setExportLoading(true);
    try {
      const endpoint = options.format === 'pdf' ? '/api/export/pdf' : '/api/export/markdown';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentIds: Array.from(selectedIds),
          options: {
            includeRecipient: options.includeRecipient,
            includeSignature: options.includeSignature,
            fontSize: options.fontSize,
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        // 下载文件
        const content = data.markdown || data.pdf;
        const filename = data.filename;
        const mimeType = options.format === 'pdf' ? 'application/pdf' : 'text/markdown';
        
        if (options.format === 'pdf') {
          // PDF 是 base64 dataURI
          const link = document.createElement('a');
          link.href = content;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else {
          // Markdown 是纯文本
          const blob = new Blob([content], { type: mimeType });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        }
        
        setExportDialogOpen(false);
        setSelectedIds(new Set());
        setIsSelectAll(false);
      } else {
        setError(data.error || '导出失败');
      }
    } catch (err) {
      setError('导出过程中发生错误');
    } finally {
      setExportLoading(false);
    }
  };

  // 批量打印
  const handleBatchPrint = () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds).join(',');
    router.push(`/print/batch?ids=${ids}`);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const truncateContent = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + '...';
  };

  const favoriteCount = history.filter(item => item.isFavorite).length;
  const handwrittenCount = history.filter(item => item.isHandwritten).length;
  const sentCount = history.filter(item => item.recipient?.status === 'sent').length;
  const hasActiveFilters = Boolean(country || startDate || endDate);
  const stats = [
    {
      label: '历史记录',
      value: total,
      helper: '累计生成内容',
      icon: FileText,
      iconClassName: 'from-orange-500 to-amber-500',
      chipClassName: 'bg-orange-50 text-orange-700 border-orange-100',
    },
    {
      label: '已收藏',
      value: favoriteCount,
      helper: '便于二次挑选',
      icon: Star,
      iconClassName: 'from-amber-500 to-orange-500',
      chipClassName: 'bg-amber-50 text-amber-700 border-amber-100',
    },
    {
      label: '手写体',
      value: handwrittenCount,
      helper: '适合打印誊写',
      icon: PenTool,

      iconClassName: 'from-blue-500 to-cyan-500',
      chipClassName: 'bg-blue-50 text-blue-700 border-blue-100',
    },
    {
      label: '已寄出',
      value: sentCount,
      helper: '已进入寄送状态',
      icon: Globe2,
      iconClassName: 'from-emerald-500 to-teal-500',
      chipClassName: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    },
  ];


  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-50 via-white to-orange-50/30">
      <Header />
      <main className="container flex-1 py-10 md:py-12">
        <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm xl:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400" />

          <div className="relative flex flex-col gap-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl space-y-5">
                <Badge className="inline-flex border-orange-100 bg-orange-50 px-3 py-1 text-[12px] font-medium tracking-[0.01em] text-orange-700 shadow-sm hover:bg-orange-50">
                  历史记录中心
                </Badge>

                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/20 ring-8 ring-orange-50 transition-transform duration-300 group-hover:scale-105">
                    <FileText className="h-8 w-8 text-white" />
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <h1 className="text-3xl font-bold tracking-[-0.02em] text-slate-900 md:text-4xl">
                        已生成内容，一处统一回看
                      </h1>
                      <p className="max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
                        这里集中展示你已经生成过的明信片内容，支持按国家与日期快速筛选，也支持批量导出与打印。
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                        <Star className="h-4 w-4 text-orange-500" />
                        精致层次
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        支持时间筛选
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5">
                        <Download className="h-4 w-4 text-slate-400" />
                        支持批量导出 / 打印
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid min-w-full gap-3 sm:grid-cols-2 xl:min-w-[360px] xl:max-w-[380px] xl:grid-cols-1">
                <div className="rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-amber-50 p-4 shadow-sm">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-orange-700">
                    <Filter className="h-4 w-4" />
                    当前筛选状态
                  </div>
                  <div className="space-y-2 text-sm text-slate-600">
                    <div className="flex items-center justify-between gap-3">
                      <span>国家</span>
                      <span className="font-medium text-slate-900">{country || '全部'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>日期范围</span>
                      <span className="text-right font-medium text-slate-900">
                        {startDate || endDate ? `${startDate || '不限'} ~ ${endDate || '不限'}` : '全部时间'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <CheckSquare className="h-4 w-4 text-orange-500" />
                    当前选择
                  </div>
                  <div className="space-y-2 text-sm text-slate-600">
                    <div className="flex items-center justify-between gap-3">
                      <span>已选择</span>
                      <span className="font-medium text-slate-900">{selectedIds.size} 项</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>可执行操作</span>
                      <span className="font-medium text-slate-900">
                        {selectedIds.size > 0 ? '导出 / 打印' : '请先勾选'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <Card
                    key={stat.label}
                    className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-lg shadow-slate-200/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                          <p className="text-3xl font-semibold tracking-[-0.02em] text-slate-900">{stat.value}</p>
                          <Badge variant="outline" className={`border ${stat.chipClassName}`}>
                            {stat.helper}
                          </Badge>
                        </div>
                        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${stat.iconClassName} shadow-md`}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        <Card className="mt-8 overflow-hidden rounded-[24px] border border-slate-200/80 bg-white/95 shadow-lg shadow-slate-200/40">
          <CardHeader className="border-b border-slate-100 bg-slate-50/70 pb-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-3 text-xl font-semibold tracking-[-0.01em] text-slate-900">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-md">
                    <Search className="h-5 w-5 text-white" />
                  </div>
                  搜索筛选
                </CardTitle>
                <CardDescription className="mt-2 text-sm text-slate-500">
                  按国家或日期范围快速定位历史内容，减少翻找成本。
                </CardDescription>
              </div>
              {hasActiveFilters && (
                <Badge className="w-fit border-amber-100 bg-amber-50 text-amber-700 hover:bg-amber-50">
                  已启用筛选
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSearch} className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
              <div className="space-y-2">
                <Label htmlFor="country" className="text-sm font-medium text-slate-700">国家</Label>
                <div className="relative">
                  <Globe2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="country"
                    placeholder="例如：Germany、USA、Japan"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="h-11 rounded-xl border-slate-200 bg-white pl-10 shadow-sm transition-colors focus-visible:border-orange-300 focus-visible:ring-orange-200"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate" className="text-sm font-medium text-slate-700">开始日期</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-11 rounded-xl border-slate-200 bg-white shadow-sm transition-colors focus-visible:border-orange-300 focus-visible:ring-orange-200"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate" className="text-sm font-medium text-slate-700">结束日期</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-11 rounded-xl border-slate-200 bg-white shadow-sm transition-colors focus-visible:border-orange-300 focus-visible:ring-orange-200"
                />
              </div>
              <div className="flex flex-col justify-end gap-2 sm:flex-row xl:flex-col">
                <Button
                  type="submit"
                  disabled={searching}
                  className="h-11 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 shadow-lg shadow-orange-500/25 hover:from-orange-600 hover:to-amber-600"
                >
                  {searching ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  搜索
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  className="h-11 rounded-xl border-slate-200 bg-white px-5 text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  重置
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <section className="mt-6 flex flex-col gap-4 rounded-[24px] border border-slate-200/80 bg-white/90 p-5 shadow-lg shadow-slate-200/30 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 hover:bg-slate-50">
              共 {total} 条记录
            </Badge>
            {selectedIds.size > 0 ? (
              <Badge className="border-orange-100 bg-orange-50 px-3 py-1 text-orange-700 hover:bg-orange-50">
                已选择 {selectedIds.size} 项
              </Badge>
            ) : (
              <span className="text-sm text-slate-500">勾选后可批量导出或打印</span>
            )}
          </div>

          {selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExportDialogOpen(true)}
                className="h-10 rounded-xl border-slate-200 bg-white px-4 shadow-sm hover:bg-slate-50"
              >
                <Download className="mr-2 h-4 w-4" />
                批量导出
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBatchPrint}
                className="h-10 rounded-xl border-slate-200 bg-white px-4 shadow-sm hover:bg-slate-50"
              >
                <Printer className="mr-2 h-4 w-4" />
                批量打印
              </Button>
            </div>
          )}
        </section>

        {error && (
          <Alert className="mt-6 rounded-2xl border border-red-200 bg-red-50 text-red-800 shadow-sm">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading && (
          <div className="mt-8 rounded-[24px] border border-slate-200/80 bg-white/90 px-6 py-16 shadow-lg shadow-slate-200/30">
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/20">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-medium text-slate-900">正在加载历史记录</p>
                <p className="text-sm text-slate-500">稍等一下，系统正在整理你的历史内容。</p>
              </div>
            </div>
          </div>
        )}

        {!loading && history.length === 0 && (
          <Card className="mt-8 overflow-hidden rounded-[24px] border border-dashed border-slate-300 bg-white/90 shadow-lg shadow-slate-200/20">
            <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-orange-100 to-amber-100 shadow-inner">
                <FileText className="h-8 w-8 text-orange-500" />
              </div>
              <h3 className="mt-5 text-xl font-semibold tracking-[-0.01em] text-slate-900">暂无历史记录</h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                你生成过的明信片内容会集中显示在这里，方便后续回看、挑选、导出与打印。
              </p>
              <Button
                className="mt-6 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 shadow-lg shadow-orange-500/25 hover:from-orange-600 hover:to-amber-600"
                onClick={() => router.push('/sent/create')}
              >
                去生成内容
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && history.length > 0 && (
          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-3 px-1 text-sm text-slate-500">
              <button
                onClick={handleSelectAll}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm transition-colors hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
              >
                {isSelectAll ? (
                  <CheckSquare className="h-5 w-5 text-orange-500" />
                ) : (
                  <Square className="h-5 w-5 text-slate-400" />
                )}
                全选当前页
              </button>
              <span>共展示 {history.length} 条结果</span>
            </div>

            {history.map((item) => (
              <Card
                key={item.id}
                className={`overflow-hidden rounded-[24px] border bg-white/95 shadow-lg shadow-slate-200/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                  selectedIds.has(item.id)
                    ? 'border-orange-300 ring-2 ring-orange-200/70'
                    : 'border-slate-200/80'
                }`}
              >
                <CardContent className="p-5 md:p-6">
                  <div className="flex flex-col gap-5 md:flex-row md:items-start">
                    <div className="flex items-start gap-4 md:w-full">
                      <div className="pt-1">
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={() => handleSelectItem(item.id)}
                          className="mt-1 h-5 w-5 rounded-md border-slate-300"
                        />
                      </div>

                      <div className="min-w-0 flex-1 space-y-4">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-semibold tracking-[-0.01em] text-slate-900 md:text-xl">
                                {item.postcardId || item.contentTitle}
                              </h3>
                              {item.isFavorite && (
                                <Badge className="border-amber-100 bg-amber-50 text-amber-700 hover:bg-amber-50">
                                  收藏
                                </Badge>
                              )}
                              {item.isHandwritten && (
                                <Badge className="border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-50">
                                  手写体
                                </Badge>
                              )}
                              {item.recipient?.status === 'sent' && (
                                <Badge className="border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                                  已寄出
                                </Badge>
                              )}
                            </div>

                            <p className="max-w-3xl text-sm leading-6 text-slate-600 md:text-[15px]">
                              {truncateContent(item.contentBody, 140)}
                            </p>

                            {item.recipient && (
                              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                                  <User className="h-4 w-4 text-slate-400" />
                                  {item.recipient.name}
                                </span>
                                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                                  <MapPin className="h-4 w-4 text-slate-400" />
                                  {item.recipient.city}, {item.recipient.country}
                                </span>
                              </div>
                            )}

                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1">
                                <Calendar className="h-3.5 w-3.5" />
                                {formatDate(item.createdAt)}
                              </span>
                              {item.tone && (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1">
                                  语气：{item.tone}
                                </span>
                              )}
                              {item.wordCount && (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1">
                                  {item.wordCount} 字
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1">
                                {item.language.toUpperCase()}
                              </span>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-2 self-start">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-10 rounded-xl border-slate-200 bg-white px-4 shadow-sm hover:bg-slate-50"
                              onClick={() => {
                                const historyId = item.id || item.postcardId || item.recipient?.id;
                                if (historyId) {
                                  window.location.href = `/sent/history/${historyId}`;
                                }
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              查看详情
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && totalPages > 1 && (
          <div className="mt-8 rounded-[24px] border border-slate-200/80 bg-white/95 p-4 shadow-lg shadow-slate-200/30">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (page > 1) setPage(page - 1);
                    }}
                    className={`rounded-xl ${page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer hover:bg-slate-50'}`}
                  />
                </PaginationItem>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }

                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setPage(pageNum);
                        }}
                        isActive={page === pageNum}
                        className={`cursor-pointer rounded-xl ${page === pageNum ? 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-50' : 'hover:bg-slate-50'}`}
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (page < totalPages) setPage(page + 1);
                    }}
                    className={`rounded-xl ${page >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer hover:bg-slate-50'}`}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </main>

      <Footer />

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        selectedCount={selectedIds.size}
        onExport={handleExport}
        onPrint={handleBatchPrint}
        isLoading={exportLoading}
      />
    </div>
  );

}
