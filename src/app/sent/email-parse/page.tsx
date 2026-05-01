"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { useAuth } from "@/hooks/useAuth";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { ListItemCard } from "@/components/ui/ListItemCard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationFirst,
  PaginationItem,
  PaginationLast,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Loader2,
  Mail,
  Search,
  Filter,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Check,
  AlertCircle,
  Unlink,
  Shield,
  ArrowLeft,
  FolderOpen,
  X,
  List,
  Lightbulb,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  useEmailConfigs,
  useSearchEmails,
  useEmailFolders,
  useSavedEmails,
} from "@/hooks/useApi";
import { toast } from "sonner";
import { EmailConfigForm } from "@/components/email/EmailConfigForm";
import { EmailStatusCard } from "@/components/email/EmailStatusCard";
import { FolderSelector } from "@/components/email/FolderSelector";
import type { EmailConfig } from "@/lib/types";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { apiFetch } from '@/lib/fetch';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { motion } from 'framer-motion';

// localStorage key for remembering folder preference
const STORAGE_KEY_EMAILS_FOLDER = "emails_last_folder";

interface Email {
  id: string;
  uid: number;
  subject: string;
  from: string;
  to: string;
  date: string;
  bodyPreview?: string;
}

function buildSafeParsedData(parsed: any) {
  return {
    id: parsed.id,
    name: parsed.name,
    country: parsed.country,
    city: parsed.city,
    address: parsed.address,
    postcardId: parsed.postcardId,
    distance: parsed.distance,
    interests: parsed.interests || [],
    dislikes: parsed.dislikes || [],
    messageToSender: parsed.messageToSender || '',
    cardPreference: parsed.cardPreference || 'any',
    contentPreference: parsed.contentPreference || '',
    languagePreference: parsed.languagePreference || '',
    specialRequests: parsed.specialRequests || '',
    source: parsed.source || 'imap_email',
    hasMaterials: parsed.hasMaterials,
    filledMaterialsCategories: parsed.filledMaterialsCategories || [],
  };
}

export default function EmailParsePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isLoading: authLoading, isAuthenticated } = useAuth();

  // ========== 状态 ==========
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [searchDialogStep, setSearchDialogStep] = useState<"config" | "search" | "results">("config");

  // 搜索相关状态
  const [searchResults, setSearchResults] = useState<Email[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "from" | "subject">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [folderPath, setFolderPath] = useState<string>("INBOX");
  const [availableFolders, setAvailableFolders] = useState<string[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 解析邮件时的加载状态
  const [parsingEmailId, setParsingEmailId] = useState<string | null>(null);
  const [parsingText, setParsingText] = useState("正在解析...");

  // 邮箱配置编辑状态
  const [editingConfig, setEditingConfig] = useState<EmailConfig | null>(null);

  // 已送达的明信片 ID 集合
  const [arrivedIds, setArrivedIds] = useState<Set<string>>(new Set());

  // 邮件预览弹窗
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewEmail, setPreviewEmail] = useState<{ subject: string; from: string; date: string; body: string } | null>(null);

  // ========== Hooks ==========
  const { data: savedEmailsData, refetch: refetchSavedEmails } = useSavedEmails();
  const { data: configs, isLoading: configsLoading, refetch: refetchConfigs } = useEmailConfigs();
  const searchMutation = useSearchEmails();
  const { data: folderData, refetch: refetchFolders } = useEmailFolders(
    configs?.[0]?.id || undefined,
  );

  // 单邮箱模式
  const hasConfig = configs && configs.length > 0;
  const currentConfig = configs?.[0];
  const selectedConfigId = currentConfig?.id || "";

  // 从 localStorage 读取上次使用的文件夹
  const loadSavedFolder = () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY_EMAILS_FOLDER);
  };

  // 保存文件夹到 localStorage
  const saveFolder = (folder: string) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY_EMAILS_FOLDER, folder);
  };

  // 文件夹变化时保存
  useEffect(() => {
    if (folderPath) saveFolder(folderPath);
  }, [folderPath]);

  // 加载文件夹列表
  useEffect(() => {
    if (folderData?.folders && folderData.folders.length > 0) {
      setAvailableFolders(folderData.folders);
      // 优先使用 localStorage，其次用配置，最后默认 INBOX
      const saved = loadSavedFolder();
      if (saved && folderData.folders.includes(saved)) {
        setFolderPath(saved);
      } else if (currentConfig?.folderPath && folderData.folders.includes(currentConfig.folderPath)) {
        setFolderPath(currentConfig.folderPath);
      }
    }
  }, [folderData, currentConfig]);

  // 加载已保存的邮件
  useEffect(() => {
    if (savedEmailsData?.emails) {
      setSearchResults(savedEmailsData.emails);
    }
  }, [savedEmailsData]);

  // 加载已送达的明信片 ID
  useEffect(() => {
    const fetchArrivedIds = async () => {
      try {
        const response = await apiFetch('/api/arrivals?limit=1000');
        const result = await response.json();
        if (result.success && result.data?.arrivals) {
          const ids = new Set<string>(
            result.data.arrivals
              .map((a: any) => a.postcardId)
              .filter(Boolean)
          );
          setArrivedIds(ids);
        }
      } catch (err) {
        console.error('Failed to fetch arrived IDs:', err);
      }
    };
    fetchArrivedIds();
  }, []);

  // ========== 处理函数 ==========

  if (authLoading) return <PageLoadingSpinner />;

  // 刷新文件夹列表
  const handleRefreshFolders = async () => {
    if (!selectedConfigId) return;
    setIsLoadingFolders(true);
    try {
      const result = await refetchFolders();
      if (result.data?.folders && result.data.folders.length > 0) {
        setAvailableFolders(result.data.folders);
        toast.success(`已获取 ${result.data.folders.length} 个文件夹`);
        if (!result.data.folders.includes("INBOX")) {
          setFolderPath(result.data.folders[0]);
        }
      }
    } catch (error: any) {
      toast.error("获取文件夹失败");
    } finally {
      setIsLoadingFolders(false);
    }
  };

  // 搜索邮件
  const handleSearch = async () => {
    if (!selectedConfigId) return;

    try {
      const result = await searchMutation.mutateAsync({
        configId: selectedConfigId,
        limit: 50,
        folderPath: folderPath,
      });

      if (result.success && result.data) {
        const emails = result.data.emails || [];
        setSearchResults(emails);
        setCurrentPage(1);
        setSearchDialogStep("results");
        await refetchSavedEmails();

        if (emails.length === 0) {
          toast.info("未找到邮件");
        } else {
          toast.success(`找到 ${emails.length} 封邮件`);
        }
      } else {
        toast.error(result.error || "搜索失败");
      }
    } catch (error: any) {
      toast.error("搜索失败：" + (error.message || "未知错误"));
    }
  };

  // 解析邮件并跳转
  const handleParseAndRedirect = async (email: Email) => {
    setParsingEmailId(email.id);
    setParsingText("正在解析邮件内容...");

    try {
      const res = await apiFetch(`/api/emails/${email.id}/parse`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 402) {
          toast.error("功能需升级到付费", { description: data.error });
          return;
        }
        toast.error(data.error || "解析失败");
        return;
      }

      const data = await res.json();
      if (data.success) {
        const parsed = data.data;
        const postcardId = parsed.postcardId;
        const safeParsedData = buildSafeParsedData(parsed);
        const storageKey = `email_parse_data_${postcardId}`;
        sessionStorage.setItem(storageKey, JSON.stringify(safeParsedData));
        toast.success("解析成功，正在跳转...");
        setTimeout(() => router.push(`/sent/email-parse/${postcardId}`), 800);
      } else {
        toast.error(data.error || "解析失败");
      }
    } catch (error) {
      toast.error("解析失败");
    } finally {
      setParsingEmailId(null);
    }
  };

  // 解绑邮箱
  const handleUnbindEmail = async () => {
    if (!confirm("确定要解除邮箱绑定吗？")) return;

    try {
      const token = typeof window !== "undefined"
        ? JSON.parse(localStorage.getItem("auth-storage") || "{}")?.state?.token
        : null;

      const response = await fetch(`/api/email-configs/${configs?.[0]?.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast.success("邮箱已解除绑定");
        await refetchConfigs();
      } else {
        toast.error("解除绑定失败");
      }
    } catch (error) {
      toast.error("解除绑定失败");
    }
  };

  // 邮箱配置成功
  const handleEmailSetupSuccess = async () => {
    await refetchConfigs();
    toast.success("邮箱配置成功！");
  };

  // 预览邮件完整内容
  const handlePreviewEmail = async (email: Email) => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewEmail(null);

    try {
      const res = await apiFetch(`/api/emails/${email.id}`);
      const result = await res.json();
      if (result.success && result.data) {
        const data = result.data;
        // 优先用 sanitized 内容，其次 htmlContent，最后 content
        const rawBody = data.content || data.htmlContent || '';
        const body = rawBody
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, '\n')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        setPreviewEmail({
          subject: data.subject || email.subject,
          from: data.from || email.from,
          date: data.receivedAt || email.date,
          body,
        });
      } else {
        toast.error('加载邮件内容失败');
        setPreviewOpen(false);
      }
    } catch {
      toast.error('加载邮件内容失败');
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  // 从邮件主题中提取明信片 ID（格式：XX-1234567）
  const extractPostcardId = (subject: string): string | null => {
    const match = subject.match(/[A-Z]{2}-\d{7}/);
    return match ? match[0] : null;
  };

  // 过滤和排序
  const filteredResults = searchResults
    .filter((email) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const postcardId = extractPostcardId(email.subject || '');
      return (
        email.subject?.toLowerCase().includes(q) ||
        email.from?.toLowerCase().includes(q) ||
        email.bodyPreview?.toLowerCase().includes(q) ||
        (postcardId && postcardId.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      // 未送达的排在前面
      const aId = extractPostcardId(a.subject || '');
      const bId = extractPostcardId(b.subject || '');
      const aArrived = aId ? arrivedIds.has(aId) : false;
      const bArrived = bId ? arrivedIds.has(bId) : false;
      if (aArrived !== bArrived) return aArrived ? 1 : -1;

      let c = 0;
      switch (sortBy) {
        case "date": c = new Date(a.date).getTime() - new Date(b.date).getTime(); break;
        case "from": c = (a.from || "").localeCompare(b.from || ""); break;
        case "subject": c = (a.subject || "").localeCompare(b.subject || ""); break;
      }
      return sortOrder === "desc" ? -c : c;
    });

  const totalPages = Math.ceil(filteredResults.length / pageSize);
  const paginatedResults = filteredResults.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-orange-50/30">
      <Header />

      <main className="container mx-auto px-4 py-8 relative">

        {/* 紧凑 Header Bar */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="flex items-center justify-between bg-white rounded-2xl shadow-lg border border-slate-200/60 p-4">
            <div className="flex items-center gap-4">
              {/* Logo 图标 */}
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-md">
                <Mail className="h-6 w-6 text-white" />
              </div>

              {/* 标题 */}
              <div>
                <h1 className="text-xl font-bold text-slate-900">邮件列表</h1>
                <p className="text-sm text-slate-500">自动解析明信片收件人邮件</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* 邮箱状态 */}
              {hasConfig ? (
                <Badge variant="outline" className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 border-emerald-200 font-medium">
                  <Check className="w-3 h-3" />
                  <span className="text-sm">{currentConfig?.email}</span>
                </Badge>
              ) : (
                <Badge variant="outline" className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 border-red-200 font-medium">
                  <AlertCircle className="w-3 h-3" />
                  <span className="text-sm">未配置</span>
                </Badge>
              )}

              {/* 主操作按钮 */}
              <Button
                onClick={() => setSearchDialogOpen(true)}
                className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-lg"
              >
                <Search className="w-4 h-4 mr-2" />
                搜索邮件
              </Button>
            </div>
          </div>
        </div>

        {/* 搜索结果区域 */}
        <div className="max-w-4xl mx-auto">

          {/* 有结果时显示工具栏 */}
          {filteredResults.length > 0 && (
            <div className="bg-white rounded-xl shadow border border-slate-200/60 p-4 mb-4 transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1)">
              <div className="flex flex-wrap gap-4 items-center justify-between">
                {/* 搜索框 */}
              <div className="flex-1 min-w-[200px] relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Search className="w-4 h-4" />
                </div>
                <Input
                  placeholder="搜索邮件..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-10 border-slate-200 focus:border-orange-300 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) shadow-sm"
                />
              </div>

                {/* 排序 */}
                <div className="flex items-center gap-2">
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                    <SelectTrigger className="w-[100px] h-9 border-slate-200 hover:border-orange-300 transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1)">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-200 shadow-lg">
                      <SelectItem value="date">按日期</SelectItem>
                      <SelectItem value="from">按发件人</SelectItem>
                      <SelectItem value="subject">按主题</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 border-slate-200 hover:border-orange-300 transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1)"
                    onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                  >
                    {sortOrder === "asc" ? (
                      <ArrowUp className="w-4 h-4" />
                    ) : (
                      <ArrowDown className="w-4 h-4" />
                    )}
                  </Button>
                </div>

                {/* 结果数量 */}
                <div className="text-sm text-slate-500">
                  共 {filteredResults.length} 封
                  {searchQuery && ` (筛选自 ${searchResults.length} 封)`}
                </div>
              </div>
            </div>
          )}

          {/* 加载状态 */}
          {searchMutation.isPending && (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}

          {/* 空状态 */}
          {!searchMutation.isPending && filteredResults.length === 0 && (
            <div className="bg-white rounded-2xl border p-8 text-center shadow-lg">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-slate-100 to-gray-100 flex items-center justify-center">
                <Mail className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                {hasConfig ? "暂无搜索结果" : "请先配置邮箱"}
              </h3>
              <p className="text-slate-500 text-sm mb-4">
                {hasConfig
                  ? "尝试调整搜索条件或文件夹"
                  : "绑定邮箱后即可搜索和解析明信片收件人邮件"}
              </p>
              {!hasConfig && (
                <Button
                  onClick={() => setSearchDialogOpen(true)}
                  className="bg-gradient-to-r from-orange-500 to-amber-500"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  配置邮箱
                </Button>
              )}
            </div>
          )}

          {/* 结果列表 */}
          {filteredResults.length > 0 && (
            <div className="space-y-3">
              {paginatedResults.map((email) => {
                const postcardId = extractPostcardId(email.subject || '');
                const isArrived = postcardId ? arrivedIds.has(postcardId) : false;
                return (
                  <motion.div
                    key={email.id}
                    whileHover={{ scale: 1.01, x: 4 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <div
                      className={cn(
                        "w-full rounded-xl border p-4 transition-all duration-200",
                        isArrived
                          ? "bg-emerald-50/50 border-emerald-200"
                          : "bg-white border-slate-200 hover:border-orange-300 hover:shadow-md cursor-pointer"
                      )}
                      onClick={() => handlePreviewEmail(email)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        {/* 左侧图标 + 内容 */}
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={cn(
                            "flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center shadow-sm",
                            isArrived
                              ? "bg-gradient-to-br from-emerald-100 to-teal-100"
                              : "bg-gradient-to-br from-orange-100 to-amber-100"
                          )}>
                            {isArrived
                              ? <Check className="h-5 w-5 text-emerald-600" />
                              : <Mail className="h-5 w-5 text-orange-600" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-slate-800 text-base truncate">
                              {postcardId || email.subject || "(无主题)"}
                            </h4>
                            {postcardId && (
                              <p className="text-sm text-slate-500 truncate mt-0.5">
                                {email.subject}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* 右侧日期 */}
                        <div className="flex-shrink-0 text-right">
                          <div className="font-mono text-sm font-medium text-slate-700 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                            {formatDate(email.date)}
                          </div>
                        </div>
                      </div>

                      {/* 底部操作栏 */}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                        <span className="text-xs text-slate-400">点击查看邮件内容</span>
                        {isArrived ? (
                          <span className="text-emerald-600 text-sm font-medium flex items-center gap-1">
                            <Check className="w-4 h-4" />
                            已送达
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleParseAndRedirect(email);
                            }}
                            disabled={parsingEmailId === email.id}
                            className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
                          >
                            {parsingEmailId === email.id ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                解析中...
                              </>
                            ) : (
                              <>
                                解析邮件
                                <ChevronRight className="w-4 h-4 ml-1" />
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="flex justify-center pt-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        {currentPage === 1 ? (
                          <PaginationFirst className="opacity-50 pointer-events-none" />
                        ) : (
                          <PaginationFirst
                            onClick={() => setCurrentPage(1)}
                            className="transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1)"
                          />
                        )}
                      </PaginationItem>
                      <PaginationItem>
                        {currentPage === 1 ? (
                          <PaginationPrevious className="opacity-50 pointer-events-none" />
                        ) : (
                          <PaginationPrevious
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            className="transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1)"
                          />
                        )}
                      </PaginationItem>

                      {currentPage > 1 && (
                        <PaginationItem>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCurrentPage(currentPage - 1)}
                            className="transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) hover:bg-orange-50 hover:text-orange-600"
                          >
                            <ChevronLeft className="w-4 h-4 mr-1" />
                            {currentPage - 1}
                          </Button>
                        </PaginationItem>
                      )}

                      <PaginationItem>
                        <Button
                          variant="outline"
                          size="sm"
                          className="pointer-events-none bg-orange-50 border-orange-200 text-orange-700 font-medium shadow-sm"
                        >
                          {currentPage}
                        </Button>
                      </PaginationItem>

                      {currentPage < totalPages && (
                        <PaginationItem>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCurrentPage(currentPage + 1)}
                            className="transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) hover:bg-orange-50 hover:text-orange-600"
                          >
                            {currentPage + 1}
                            <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </PaginationItem>
                      )}

                      <PaginationItem>
                        {currentPage === totalPages ? (
                          <PaginationNext className="opacity-50 pointer-events-none" />
                        ) : (
                          <PaginationNext
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            className="transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1)"
                          />
                        )}
                      </PaginationItem>
                      <PaginationItem>
                        {currentPage === totalPages ? (
                          <PaginationLast className="opacity-50 pointer-events-none" />
                        ) : (
                          <PaginationLast
                            onClick={() => setCurrentPage(totalPages)}
                            className="transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1)"
                          />
                        )}
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* 搜索邮件弹窗 */}
      <Dialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {searchDialogStep === "results" && (
                <ArrowLeft
                  className="w-4 h-4 cursor-pointer hover:text-orange-600 transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1)"
                  onClick={() => setSearchDialogStep("config")}
                />
              )}
              {searchDialogStep === "config" ? (
                hasConfig ? (
                  <>
                    <Search className="w-5 h-5" />
                    <span>搜索邮件</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-5 h-5" />
                    <span>配置邮箱</span>
                  </>
                )
              ) : (
                <>
                  <List className="w-5 h-5" />
                  <span>搜索结果</span>
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {/* 未配置邮箱 或 点击了添加/切换邮箱：显示配置表单 */}
            {(!hasConfig || editingConfig !== null) && searchDialogStep === "config" && (
              <div className="space-y-4">
                {!hasConfig && (
                  <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 text-sm text-amber-800">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <span>配置邮箱后即可搜索和解析明信片收件人邮件</span>
                    </div>
                  </div>
                )}
                <EmailConfigForm
                  editConfig={editingConfig}
                  onSuccess={() => {
                    setEditingConfig(null);
                    handleEmailSetupSuccess();
                  }}
                  onCancel={() => {
                    setEditingConfig(null);
                  }}
                />
              </div>
            )}

            {/* 已配置邮箱 且 未编辑：显示搜索表单 */}
            {hasConfig && !editingConfig && searchDialogStep === "config" && (
              <div className="space-y-4 py-2">
                {/* 当前邮箱状态（共用组件） */}
                <EmailStatusCard
                  email={currentConfig?.email ?? ""}
                  actions={
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingConfig(currentConfig || null)}
                        className="text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50 h-7 transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1)"
                      >
                        + 添加/切换邮箱
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleUnbindEmail}
                        className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50 h-7 transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1)"
                      >
                        <Unlink className="w-3 h-3 mr-1" />
                        解绑
                      </Button>
                    </>
                  }
                />

                {/* 文件夹选择（共用组件） */}
                <FolderSelector
                  value={folderPath}
                  folders={availableFolders}
                  isLoading={isLoadingFolders}
                  onChange={setFolderPath}
                  onRefresh={handleRefreshFolders}
                  hint={
                    <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 text-sm text-amber-700">
                      <div className="flex items-start gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p>提示：明信片收件人邮件通常在 <strong>INBOX</strong> 文件夹中。</p>
                          <p className="text-amber-600 mt-1">系统会自动记住您上次选择的文件夹。</p>
                        </div>
                      </div>
                    </div>
                  }
                />

                {/* 操作按钮 */}
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setSearchDialogOpen(false)}>
                    取消
                  </Button>
                  <Button
                    onClick={handleSearch}
                    disabled={searchMutation.isPending}
                    className="bg-gradient-to-r from-orange-500 to-amber-500"
                  >
                    {searchMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        搜索中...
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-2" />
                        开始搜索
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* 搜索结果 */}
            {searchDialogStep === "results" && (
              <div className="space-y-3">
                {searchResults.length === 0 ? (
                  <div className="text-center py-8">
                    <Mail className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-slate-500">未找到邮件</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSearchDialogStep("config")}
                      className="mt-3"
                    >
                      修改搜索条件
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-slate-500">
                      找到 {searchResults.length} 封邮件，点击即可解析
                    </div>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {searchResults.map((email) => {
                        const postcardId = extractPostcardId(email.subject || '');
                        const isArrived = postcardId ? arrivedIds.has(postcardId) : false;
                        return (
                        <div
                          key={email.id}
                          onClick={() => {
                            if (isArrived) return;
                            handleParseAndRedirect(email);
                            setSearchDialogOpen(false);
                          }}
                          className={cn(
                            "p-3 rounded-lg border border-slate-200 cursor-pointer hover:border-orange-300 hover:bg-orange-50/50 transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) shadow-sm",
                            parsingEmailId === email.id && "opacity-50 pointer-events-none",
                            isArrived && "opacity-60 cursor-default hover:border-slate-200 hover:bg-white"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center shadow-md flex-shrink-0",
                              isArrived
                                ? "bg-gradient-to-br from-emerald-500 to-teal-500"
                                : "bg-gradient-to-br from-blue-500 to-cyan-500"
                            )}>
                              {isArrived
                                ? <Check className="w-5 h-5 text-white" />
                                : <Mail className="w-5 h-5 text-white" />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              {postcardId ? (
                                <>
                                  <div className="font-mono font-bold text-orange-600 text-sm">
                                    {postcardId}
                                  </div>
                                  <div className="text-xs text-slate-500 truncate mt-0.5">
                                    {email.subject}
                                  </div>
                                </>
                              ) : (
                                <div className="font-medium text-slate-900 truncate">
                                  {email.subject || "(无主题)"}
                                </div>
                              )}
                              <div className="text-xs text-slate-400 mt-1">
                                {formatDate(email.date)}
                              </div>
                            </div>
                            {parsingEmailId === email.id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                            ) : isArrived ? (
                              <span className="text-emerald-600 text-xs font-medium flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" />
                                已送达
                              </span>
                            ) : (
                              <ChevronRight className="h-4 w-4 text-slate-400" />
                            )}
                          </div>
                        </div>
                      )})}
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSearchDialogStep("config")}
                        className="transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) shadow-sm"
                      >
                        继续搜索
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSearchDialogOpen(false)}
                        className="transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) shadow-sm"
                      >
                        查看全部结果
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 邮件预览弹窗 */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 w-5 text-orange-500" />
              邮件内容
            </DialogTitle>
            <DialogDescription>
              查看邮件原始内容，确认收件人信息
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {previewLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
              </div>
            ) : previewEmail ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
                  <div className="text-sm text-slate-500 mb-1">主题</div>
                  <div className="font-medium text-slate-900">{previewEmail.subject}</div>
                </div>
                <div className="rounded-lg bg-white p-4 border border-slate-200 whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
                  {previewEmail.body || "（无内容）"}
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
