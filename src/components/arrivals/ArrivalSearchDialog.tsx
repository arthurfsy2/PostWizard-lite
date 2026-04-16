"use client";

import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useSearchArrivalEmails,
  useParseArrivalEmails,
} from "@/hooks/useArrivals";
import { useEmailConfigs, useEmailFolders } from "@/hooks/useApi";
import { apiFetch } from '@/lib/fetch';
import { EmailConfigForm } from "@/components/email/EmailConfigForm";
import { FolderSelector } from "@/components/email/FolderSelector";
import type { EmailConfig } from "@/lib/types";
import { ArrowLeft, CheckCircle, Unlink, RefreshCw, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { ParseProgressPanel, type ParseLogEntry } from "@/components/arrivals/ParseProgressPanel";

// localStorage key for remembering folder preference
const STORAGE_KEY_ARRIVALS_FOLDER = "arrivals_last_folder";

interface ArrivalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
  onSearchStats?: (stats: {
    total: number;
    parsed: number;
    pending: number;
  }) => void;
}

export function ArrivalSearchDialog({
  open,
  onOpenChange,
  onComplete,
  onSearchStats,
}: ArrivalSearchDialogProps) {
  // Dialog steps: config -> results -> parsing
  const [step, setStep] = useState<"config" | "results" | "parsing">(
    "config",
  );
  const [selectedConfig, setSelectedConfig] = useState<EmailConfig | null>(null);
  const [folderPath, setFolderPath] = useState<string>("INBOX");
  const [searchCount, setSearchCount] = useState<{
    total: number;
    existing: number;
    new: number;
  } | null>(null);
  const [parseLog, setParseLog] = useState<ParseLogEntry[]>([]);
  const [availableFolders, setAvailableFolders] = useState<string[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [forceReparse, setForceReparse] = useState(false);
  const [editingConfig, setEditingConfig] = useState<EmailConfig | null>(null);
  const queryClient = useQueryClient();

  const { data: configs, isLoading: configsLoading, refetch: refetchConfigs } = useEmailConfigs();
  const { data: folderData, refetch: refetchFolders } = useEmailFolders(
    selectedConfig?.id || undefined,
  );
  const { search, isLoading: searching } = useSearchArrivalEmails();
  const { parse, isParsing, progress } = useParseArrivalEmails();

  // 是否有已配置的邮箱
  const hasConfigs = configs && configs.length > 0;

  // 从 localStorage 读取上次使用的文件夹
  const loadSavedFolder = useCallback(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY_ARRIVALS_FOLDER);
  }, []);

  // 保存文件夹到 localStorage
  const saveFolder = useCallback((folder: string) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY_ARRIVALS_FOLDER, folder);
  }, []);

  // 当文件夹变化时保存
  useEffect(() => {
    if (folderPath) {
      saveFolder(folderPath);
    }
  }, [folderPath, saveFolder]);

  // 当邮箱配置变化时，加载文件夹列表并恢复上次选择
  useEffect(() => {
    console.log("[ArrivalSearchDialog] folderData:", folderData);
    if (folderData?.folders && folderData.folders.length > 0) {
      setAvailableFolders(folderData.folders);
      console.log("[ArrivalSearchDialog] Set folders:", folderData.folders);
      
      // 优先使用 localStorage 保存的文件夹，其次用配置中的文件夹，最后默认 INBOX
      const savedFolder = loadSavedFolder();
      if (savedFolder && folderData.folders.includes(savedFolder)) {
        setFolderPath(savedFolder);
      } else if (selectedConfig?.folderPath && folderData.folders.includes(selectedConfig.folderPath)) {
        setFolderPath(selectedConfig.folderPath);
      } else {
        setFolderPath("INBOX");
      }
    }
  }, [folderData, selectedConfig, loadSavedFolder]);

  // 刷新文件夹列表
  const handleRefreshFolders = async () => {
    if (!selectedConfig?.id) return;

    setIsLoadingFolders(true);
    try {
      const result = await refetchFolders();
      if (result.data?.folders && result.data.folders.length > 0) {
        setAvailableFolders(result.data.folders);
        toast.success(`已获取 ${result.data.folders.length} 个文件夹`);
        
        // 选择第一个非 INBOX 的文件夹作为默认（如果 INBOX 不在里面）
        if (!result.data.folders.includes("INBOX")) {
          const savedFolder = loadSavedFolder();
          if (savedFolder && result.data.folders.includes(savedFolder)) {
            setFolderPath(savedFolder);
          } else {
            setFolderPath(result.data.folders[0]);
          }
        }
      } else {
        setAvailableFolders([]);
        toast.info("未找到文件夹，将使用默认 INBOX");
      }
    } catch (error: any) {
      toast.error("获取文件夹失败：" + (error.message || "请检查邮箱配置"));
    } finally {
      setIsLoadingFolders(false);
    }
  };

  // 重置状态
  useEffect(() => {
    if (!open) {
      setStep("config");
      setSelectedConfig(null);
      setFolderPath("INBOX");
      setSearchCount(null);
      setParseLog([]);
      setAvailableFolders([]);
      setIsLoadingFolders(false);
      setForceReparse(false);
    }
  }, [open]);

  // 自动选择唯一的邮箱配置
  useEffect(() => {
    if (open && hasConfigs && configs && configs.length === 1 && !selectedConfig) {
      setSelectedConfig(configs[0]);
    }
  }, [open, hasConfigs, configs, selectedConfig]);

  // 处理文件夹选择
  const handleFolderChange = (value: string) => {
    if (value === "__custom__") {
      setFolderPath("");
    } else if (value === "__default__") {
      setFolderPath("INBOX");
    } else {
      setFolderPath(value);
    }
  };

  // 搜索邮件
  const handleSearch = async () => {
    if (!selectedConfig?.id) return;

    const result = await search({
      configId: selectedConfig.id,
      folder: folderPath,
      limit: 100,
    });

    if (result) {
      const totalCount = result.totalCount;
      const existingCount = result.existingCount;
      const newCount = result.newCount;

      setSearchCount({
        total: totalCount,
        existing: existingCount,
        new: newCount,
      });

      // 通知父组件更新统计显示
      onSearchStats?.({
        total: totalCount,
        parsed: existingCount,
        pending: newCount,
      });

      setStep("results");
    }
  };

  // 开始解析
  const handleParse = async () => {
    if (!selectedConfig?.id) return;

    setStep("parsing");
    setParseLog([{ type: "info", message: "开始解析邮件..." }]);

    try {
      await parse(
        {
          configId: selectedConfig.id,
          folder: folderPath,
          limit: forceReparse ? 100 : (searchCount?.new || 20),
          forceAll: true,
          forceReparse,
        },
        (event) => {
          switch (event.type) {
            case "status":
              setParseLog((prev) => [
                ...prev,
                { type: "info", message: event.data.message },
              ]);
              break;
            case "progress":
              break;
            case "success":
              setParseLog((prev) => [
                ...prev,
                {
                  type: "success",
                  message: `✅ 解析成功: ${event.data.postcardId} (${event.data.country})`,
                },
              ]);
              break;
            case "skip":
              setParseLog((prev) => [
                ...prev,
                {
                  type: "warning",
                  message: `⏭️ 跳过: ${event.data.postcardId || "无ID"} (${event.data.reason})`,
                },
              ]);
              break;
            case "error":
              setParseLog((prev) => [
                ...prev,
                {
                  type: "error",
                  message: `❌ 失败: ${event.data.postcardId || "未知"} (${event.data.error})`,
                },
              ]);
              break;
            case "complete":
              setParseLog((prev) => [
                ...prev,
                {
                  type: "success",
                  message: `🎉 完成! 成功: ${event.data.success}, 失败: ${event.data.failed}, 跳过: ${event.data.skipped}`,
                },
              ]);
              onComplete?.();
              break;
          }
        },
      );
    } catch (error: any) {
      setParseLog((prev) => [
        ...prev,
        { type: "error", message: `解析出错: ${error.message}` },
      ]);
    }
  };

  // 取消
  const handleCancel = () => {
    onOpenChange(false);
  };

  // 完成关闭
  const handleClose = () => {
    onComplete?.();
    onOpenChange(false);
  };

  // 解绑邮箱
  const handleUnbindEmail = async () => {
    if (!selectedConfig?.id) return;
    
    try {
      await apiFetch(`/api/email-configs/${selectedConfig.id}`, {
        method: "DELETE",
      });
      
      toast.success("邮箱已解绑");
      await refetchConfigs();
      setStep("config");
    } catch (error: any) {
      toast.error(`解绑失败：${error.message}`);
    }
  };

  // 邮箱配置成功后的回调
  const handleEmailSetupSuccess = async () => {
    await refetchConfigs();
    // 自动选中新配置
    setTimeout(() => {
      const newConfigs = queryClient.getQueryData<any>(["emailConfigs"]);
      if (newConfigs && newConfigs.length > 0) {
        setSelectedConfig(newConfigs[0]);
      }
    }, 500);
    setStep("config");
    toast.success("邮箱配置成功！请继续选择文件夹");
  };

  const handleBackToResults = () => {
    if (!isParsing) {
      setStep("results");
    }
  };

  const parsingTitle = forceReparse ? "强制重新解析中" : "正在解析邮件";
  const parsingSubtitle = forceReparse
    ? `将删除并重新解析 ${searchCount?.existing || 0} 条旧记录`
    : `正在处理 ${searchCount?.new || 0} 封待解析邮件`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "results" && (
              <ArrowLeft 
                className="w-4 h-4 cursor-pointer hover:text-orange-600" 
                onClick={() => setStep("config")} 
              />
            )}
            {step === "config" ? (
              hasConfigs ? "🔍 搜索邮件" : "📧 配置邮箱"
            ) : "📋 搜索结果"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {/* 未配置邮箱 或 点击了添加/切换邮箱：显示配置表单 */}
          {(!hasConfigs || editingConfig !== null) && step === "config" && (
            <div className="space-y-4">
              {!hasConfigs && (
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 text-sm text-amber-800">
                  💡 配置邮箱后即可搜索和解析明信片送达确认邮件
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
          {hasConfigs && !editingConfig && step === "config" && (
            <div className="space-y-4 py-2">
              {/* 当前邮箱状态（共用组件） */}
              <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm text-emerald-700 font-medium">{configs?.[0]?.email}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingConfig(configs[0] || null)}
                    className="text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50 h-7"
                  >
                    + 添加/切换邮箱
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleUnbindEmail}
                    className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50 h-7"
                  >
                    <Unlink className="w-3 h-3 mr-1" />
                    解绑
                  </Button>
                </div>
              </div>

              {/* 文件夹选择（共用组件） */}
              <FolderSelector
                value={folderPath}
                folders={availableFolders}
                isLoading={isLoadingFolders}
                onChange={(path) => handleFolderChange(path === "__default__" ? "" : path)}
                onRefresh={handleRefreshFolders}
                hint={
                  <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 text-sm text-amber-700">
                    <p>💡 提示：明信片送达确认邮件通常在 <strong>INBOX</strong> 文件夹中。</p>
                    <p className="text-amber-600 mt-1">系统会自动记住您上次选择的文件夹。</p>
                  </div>
                }
              />

              {/* 操作按钮 */}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  取消
                </Button>
                <Button
                  onClick={handleSearch}
                  disabled={searching}
                  className="bg-gradient-to-r from-orange-500 to-amber-500"
                >
                  {searching ? (
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

          {/* 搜索结果（确认 + 解析） */}
          {step === "results" && searchCount && (
            <div className="space-y-3">
              {/* 统计信息 */}
              <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                <div className="text-center mb-4">
                  <div className="text-3xl font-bold text-orange-600">
                    {searchCount.total}
                  </div>
                  <div className="text-sm text-gray-600">封邮件符合条件</div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white rounded-lg p-2">
                    <div className="text-lg font-bold text-emerald-600">
                      {searchCount.existing}
                    </div>
                    <div className="text-xs text-gray-500">已解析</div>
                  </div>
                  <div className="bg-white rounded-lg p-2">
                    <div className="text-lg font-bold text-blue-600">
                      {searchCount.new}
                    </div>
                    <div className="text-xs text-gray-500">待解析</div>
                  </div>
                  <div className="bg-white rounded-lg p-2">
                    <div className="text-lg font-bold text-gray-600">
                      {searchCount.total}
                    </div>
                    <div className="text-xs text-gray-500">总计</div>
                  </div>
                </div>
              </div>

              {/* 解析选项 */}
              <div className="space-y-2">
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg p-3 border border-orange-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center text-white font-bold text-sm">
                        {searchCount.new}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          解析全部待解析邮件
                        </div>
                        <div className="text-xs text-gray-500">
                          将解析 {searchCount.new} 封新邮件
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  💡 系统会自动解析所有未保存的邮件
                </p>
              </div>

              {/* 强制重新解析选项 */}
              {searchCount.existing > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <input
                      type="checkbox"
                      id="forceReparse"
                      checked={forceReparse}
                      onChange={(e) => setForceReparse(e.target.checked)}
                      className="h-4 w-4 rounded border-amber-300 text-orange-600 focus:ring-orange-500"
                    />
                    <label htmlFor="forceReparse" className="text-sm text-amber-800 cursor-pointer">
                      <span className="font-medium">强制重新解析</span>
                      <span className="text-amber-600 ml-1">
                        （删除 {searchCount.existing} 条旧记录后重新解析）
                      </span>
                    </label>
                  </div>
                  {forceReparse && (
                    <p className="text-xs text-amber-700">
                      ⚠️ 警告：将删除已解析的 {searchCount.existing} 条记录并重新解析。
                    </p>
                  )}
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStep("config")}
                >
                  继续搜索
                </Button>
                <Button
                  onClick={handleParse}
                  disabled={searchCount.new === 0 && !(forceReparse && searchCount.existing > 0)}
                  className="bg-gradient-to-r from-orange-500 to-amber-500"
                >
                  {forceReparse ? "强制重新解析" : "开始解析"}
                </Button>
              </div>
            </div>
          )}

          {step === "parsing" && (
            <div className="space-y-3 py-2">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToResults}
                  disabled={isParsing}
                  className="-ml-2 text-gray-600 hover:text-orange-600"
                >
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  返回结果页
                </Button>
                {!isParsing && (
                  <Button variant="outline" size="sm" onClick={handleClose}>
                    完成
                  </Button>
                )}
              </div>

              <ParseProgressPanel
                title={parsingTitle}
                subtitle={parsingSubtitle}
                progress={progress}
                logs={parseLog}
                isParsing={isParsing}
                emptyText="正在等待解析器返回日志..."
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
