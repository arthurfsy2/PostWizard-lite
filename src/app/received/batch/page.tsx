"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import CardDrawDialog, { type CardData } from "@/components/cards/CardDrawDialog";
import {
  Upload,
  X,
  Camera,
  ImageIcon,
  Loader2,
  Check,
  AlertCircle,
  RotateCcw,
  Sparkles,
} from "lucide-react";

interface QueueItem {
  id: string;
  file: File;
  previewUrl: string;
  status: "pending" | "uploading" | "done" | "error" | "duplicate";
  result?: any;
  error?: string;
}

const RARITY_COLORS: Record<string, string> = {
  SSR: "from-yellow-400 to-amber-500",
  SR: "from-slate-300 to-slate-400",
  R: "from-orange-400 to-amber-500",
  N: "from-slate-400 to-slate-500",
};

const RARITY_BG: Record<string, string> = {
  SSR: "bg-yellow-50 border-yellow-300",
  SR: "bg-slate-50 border-slate-300",
  R: "bg-orange-50 border-orange-300",
  N: "bg-gray-50 border-gray-300",
};

export default function BatchUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<{ total: number; success: number; duplicate: number; error: number } | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = useCallback((files: FileList | File[]) => {
    const newItems: QueueItem[] = [];
    for (const file of Array.from(files)) {
      if (!["image/jpeg", "image/png", "image/heic", "image/webp"].includes(file.type)) continue;
      if (file.size > 10 * 1024 * 1024) continue;
      // 去重（同名同大小）
      if (queue.some(q => q.file.name === file.name && q.file.size === file.size)) continue;

      const reader = new FileReader();
      const itemId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      reader.onload = (e) => {
        setQueue(prev => prev.map(q =>
          q.id === itemId ? { ...q, previewUrl: e.target?.result as string } : q
        ));
      };
      reader.readAsDataURL(file);
      newItems.push({ id: itemId, file, previewUrl: "", status: "pending" });
    }
    if (newItems.length > 0) {
      setQueue(prev => [...prev, ...newItems]);
    }
  }, [queue]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const removeItem = (id: string) => {
    setQueue(prev => prev.filter(q => q.id !== id));
  };

  const retryItem = async (item: QueueItem) => {
    setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: "uploading", error: undefined } : q));
    // 重试单张：走 batch API（只发一张）
    const formData = new FormData();
    formData.append("images", item.file);
    try {
      const res = await fetch("/api/received-cards/batch", { method: "POST", body: formData });
      if (!res.ok || !res.body) throw new Error("重试请求失败");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));
          if (data.done) continue;
          applyResult(data);
        }
      }
    } catch (err: any) {
      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: "error", error: err.message } : q));
    }
  };

  // processSingleItem 已废弃，改用 batch API + SSE

  // 从文件名提取 postcardId（与后端相同的正则）
  const extractIdFromFilename = (name: string): string | null => {
    const match = name.match(/^([A-Z]{2}-\d{5,})/i);
    return match ? match[1].toUpperCase() : null;
  };

  // 应用单条 SSE 结果到队列
  const applyResult = (data: any) => {
    const idx = data.index;
    setQueue(prev => {
      const item = prev[idx];
      if (!item) return prev;
      const updated = [...prev];
      if (data.status === "duplicate") {
        updated[idx] = { ...item, status: "duplicate", result: { duplicateInfo: data.duplicateInfo } };
      } else if (data.status === "error") {
        updated[idx] = { ...item, status: "error", error: data.error };
      } else if (data.status === "success") {
        updated[idx] = { ...item, status: "done", result: { card: data.card, gacha: data.gacha } };
      }
      return updated;
    });
  };

  const startUpload = async () => {
    const pendingItems = queue.filter(q => q.status === "pending");
    if (pendingItems.length === 0) return;

    setUploading(true);
    setSummary(null);

    // ===== 第一步：批量预检查文件名 ID（跳过已存在的，省去不必要的 OCR）=====
    const idToItemMap = new Map<string, string>();
    for (const item of pendingItems) {
      const id = extractIdFromFilename(item.file.name);
      if (id) idToItemMap.set(id, item.id);
    }

    const precheckDuplicateIds = new Set<string>();
    if (idToItemMap.size > 0) {
      try {
        const res = await fetch("/api/received-cards/check-duplicates-bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postcardIds: Array.from(idToItemMap.keys()) }),
        });
        if (res.ok) {
          const { duplicates } = await res.json();
          duplicates.forEach((id: string) => precheckDuplicateIds.add(id));
        }
      } catch {}
    }

    // 根据预检查结果，确定哪些需要发送到 batch API
    const stillPending: { item: QueueItem; queueIdx: number }[] = [];
    pendingItems.forEach((item, idx) => {
      const fileId = extractIdFromFilename(item.file.name);
      if (fileId && precheckDuplicateIds.has(fileId)) return; // 预检查跳过
      const queueIdx = queue.indexOf(item);
      stillPending.push({ item, queueIdx: queueIdx >= 0 ? queueIdx : idx });
    });

    // 更新队列状态：预检查重复 → duplicate，其余 → uploading
    const precheckDuplicateItemIds = new Set<string>();
    for (const item of pendingItems) {
      const fileId = extractIdFromFilename(item.file.name);
      if (fileId && precheckDuplicateIds.has(fileId)) {
        precheckDuplicateItemIds.add(item.id);
      }
    }
    setQueue(prev => prev.map(q => {
      if (q.status !== "pending") return q;
      if (precheckDuplicateItemIds.has(q.id)) {
        return { ...q, status: "duplicate", result: { duplicateInfo: { postcardId: extractIdFromFilename(q.file.name) } } };
      }
      return { ...q, status: "uploading" as const };
    }));

    if (stillPending.length === 0) {
      setQueue(prev => {
        const s = prev.filter(q => q.status === "done").length;
        const d = prev.filter(q => q.status === "duplicate").length;
        const e = prev.filter(q => q.status === "error").length;
        setSummary({ total: prev.length, success: s, duplicate: d, error: e });
        return prev;
      });
      setUploading(false);
      return;
    }

    // ===== 第二步：发送到 batch API（附带原始队列 index）=====
    const formData = new FormData();
    const queueIndices: number[] = [];
    for (const { item, queueIdx } of stillPending) {
      formData.append("images", item.file);
      queueIndices.push(queueIdx);
    }
    formData.append("indices", JSON.stringify(queueIndices));

    try {
      const response = await fetch("/api/received-cards/batch", {
        method: "POST",
        body: formData,
      });

      if (!response.ok || !response.body) {
        throw new Error("批量上传请求失败");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.started) {
              // total = batch API 实际处理的数量（不含预检查跳过的）
              setProgress({ done: 0, total: data.total });
              continue;
            }
            if (data.done) {
              setSummary(data.summary);
              setProgress(null);
              continue;
            }
            // batch API 已返回原始 queue index，直接应用
            applyResult(data);
            // 只统计 batch API 实际返回的结果（不含预检查跳过的）
            setProgress(prev => prev ? { ...prev, done: prev.done + 1 } : null);
          } catch {}
        }
      }
    } catch (err: any) {
      setQueue(prev => prev.map(q =>
        q.status === "uploading" ? { ...q, status: "error" as const, error: err.message } : q
      ));
    }

    setUploading(false);
  };

  const doneItems = queue.filter(q => q.status === "done");
  const pendingItems = queue.filter(q => q.status === "pending");
  const errorItems = queue.filter(q => q.status === "error");

  // 检测是否有 OCR 配额耗尽的卡片
  const hasOcrQuotaExhausted = queue.some(q => q.result?.card?.ocrQuotaExhausted);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-orange-50/30">
      <Header />

      <main className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* 标题 */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">批量上传明信片</h1>
            <p className="text-slate-500">选择多张明信片图片，自动识别并抽卡</p>
          </div>

          {/* OCR 配额耗尽警告 */}
          {hasOcrQuotaExhausted && (
            <div className="bg-red-50 border border-red-300 rounded-xl p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">AI 识别服务不可用</p>
                <p className="text-xs text-red-600 mt-1">
                  AI 服务的免费额度已耗尽，手写内容识别暂时无法使用。图片已上传成功，但手写内容为空。请联系管理员升级 API 套餐后重试。
                </p>
              </div>
            </div>
          )}

          {/* 上传区 */}
          <div
            className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all mb-6 ${
              isDragging ? "border-orange-500 bg-orange-50" : "border-slate-300 hover:border-orange-400"
            }`}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
          >
            <div className="text-5xl mb-4">📷</div>
            <p className="text-lg font-medium text-slate-700 mb-2">拖拽图片到此处</p>
            <p className="text-sm text-slate-500 mb-4">支持 JPG/PNG/HEIC/WEBP，最大 10MB，可多选</p>
            <p className="text-xs text-slate-400 mb-4">已收录的明信片 ID 会自动跳过，不会覆盖。如需重新识别请到收信详情页操作</p>
            <p className="text-xs text-slate-500 mb-4 font-bold">建议照片使用明信片 ID 进行命名，这样将提升 ID 的识别准确率</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-all shadow-lg inline-flex items-center gap-2"
            >
              <ImageIcon className="w-5 h-5" />
              选择图片
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/heic,image/webp"
              multiple
              onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
              className="hidden"
            />
          </div>

          {/* 队列列表 */}
          {queue.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    上传队列 ({queue.length} 张)
                    {doneItems.length > 0 && <span className="ml-2 text-sm text-emerald-600">{doneItems.length} 完成</span>}
                    {queue.filter(q => q.status === "duplicate").length > 0 && <span className="ml-2 text-sm text-amber-600">{queue.filter(q => q.status === "duplicate").length} 跳过</span>}
                    {errorItems.length > 0 && <span className="ml-2 text-sm text-red-600">{errorItems.length} 失败</span>}
                  </h2>
                  {progress && (
                    <div className="mt-1.5">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Loader2 className="w-3 h-3 animate-spin text-orange-500" />
                        <span>识别中 {progress.done}/{progress.total}</span>
                      </div>
                      <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-300"
                          style={{ width: `${(progress.done / progress.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  {errorItems.length > 0 && (
                    <button
                      onClick={() => errorItems.forEach(retryItem)}
                      className="px-4 py-2 text-sm text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50 transition-all inline-flex items-center gap-1"
                    >
                      <RotateCcw className="w-4 h-4" />
                      重试失败项
                    </button>
                  )}
                  {pendingItems.length > 0 && !uploading && (
                    <button
                      onClick={startUpload}
                      className="px-6 py-2 text-sm bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-all shadow-lg inline-flex items-center gap-1"
                    >
                      <Upload className="w-4 h-4" />
                      开始上传 ({pendingItems.length})
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {queue.map((item) => (
                  <div key={item.id} className={`flex items-center gap-4 p-3 rounded-xl border transition-all ${
                    item.status === "done" ? "bg-emerald-50 border-emerald-200" :
                    item.status === "error" ? "bg-red-50 border-red-200" :
                    item.status === "duplicate" ? "bg-amber-50 border-amber-200" :
                    item.status === "uploading" ? "bg-blue-50 border-blue-200" :
                    "bg-white border-slate-200"
                  }`}>
                    {/* 缩略图 */}
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                      {item.previewUrl ? (
                        <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <ImageIcon className="w-6 h-6" />
                        </div>
                      )}
                    </div>

                    {/* 信息 */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{item.file.name}</p>
                      <p className="text-xs text-slate-500">{(item.file.size / 1024 / 1024).toFixed(1)} MB</p>
                      {item.status === "done" && item.result?.gacha && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold bg-gradient-to-r ${RARITY_COLORS[item.result.gacha.rarity] || RARITY_COLORS.N} text-white`}>
                            {item.result.gacha.rarity}
                          </span>
                          <span className="text-xs text-slate-600">{item.result.gacha.cardName}</span>
                          {item.result.gacha.aiEvaluation && (
                            <span className="text-xs text-slate-500">
                              {(item.result.gacha.aiEvaluation.touchingScore + item.result.gacha.aiEvaluation.emotionalScore + item.result.gacha.aiEvaluation.culturalInsightScore)}分
                            </span>
                          )}
                        </div>
                      )}
                      {item.status === "duplicate" && (
                        <p className="text-xs text-amber-600 mt-1">ID 已存在，已跳过: {item.result?.duplicateInfo?.postcardId}</p>
                      )}
                      {item.error && <p className="text-xs text-red-600 mt-1">{item.error}</p>}
                    </div>

                    {/* 状态/操作 */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {item.status === "uploading" && <Loader2 className="w-5 h-5 animate-spin text-blue-500" />}
                      {item.status === "done" && <Check className="w-5 h-5 text-emerald-500" />}
                      {item.status === "duplicate" && <AlertCircle className="w-5 h-5 text-amber-500" />}
                      {item.status === "error" && (
                        <button onClick={() => retryItem(item)} className="text-orange-500 hover:text-orange-700">
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                      {item.status === "pending" && (
                        <button onClick={() => removeItem(item.id)} className="text-slate-400 hover:text-red-500">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 汇总区域 */}
          {summary && doneItems.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900">
                  <Sparkles className="w-5 h-5 inline mr-2 text-orange-500" />
                  抽卡结果汇总
                </h2>
                <div className="flex gap-2 text-sm">
                  <span className="text-emerald-600">{summary.success} 成功</span>
                  {summary.duplicate > 0 && <span className="text-amber-600">{summary.duplicate} 重复</span>}
                  {summary.error > 0 && <span className="text-red-600">{summary.error} 失败</span>}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {doneItems.map((item) => {
                  const gacha = item.result?.gacha;
                  if (!gacha) return null;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        const card = item.result?.card;
                        setSelectedCard({
                          id: card?.id || "",
                          imageUrl: gacha.imageUrl,
                          userImageUrl: item.previewUrl,
                          title: gacha.cardName,
                          description: gacha.description,
                          rarity: gacha.rarity,
                          luckyLevel: gacha.luckyLevel,
                          luckyBonus: gacha.luckyBonus,
                          aiEvaluation: gacha.aiEvaluation || { summary: "", touchingScore: 0, emotionalScore: 0, culturalInsightScore: 0, primaryCategory: "emotional" as const },
                        });
                      }}
                      className={`p-3 rounded-xl border-2 transition-all hover:shadow-lg hover:-translate-y-0.5 ${RARITY_BG[gacha.rarity] || RARITY_BG.N}`}
                    >
                      <div className="aspect-square rounded-lg overflow-hidden bg-white mb-2">
                        <img
                          src={item.previewUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold bg-gradient-to-r ${RARITY_COLORS[gacha.rarity] || RARITY_COLORS.N} text-white`}>
                          {gacha.rarity}
                        </span>
                        {gacha.aiEvaluation && (
                          <span className="text-xs font-bold text-slate-700">
                            {gacha.aiEvaluation.touchingScore + gacha.aiEvaluation.emotionalScore + gacha.aiEvaluation.culturalInsightScore}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-1 truncate">{gacha.cardName}</p>
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-center gap-4 mt-6">
                <button
                  onClick={() => router.push("/received/history")}
                  className="px-6 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-all shadow-lg"
                >
                  查看卡册
                </button>
                <button
                  onClick={() => { setQueue([]); setSummary(null); }}
                  className="px-6 py-3 border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-all"
                >
                  继续上传
                </button>
              </div>
            </div>
          )}

          {/* 返回链接 */}
          <div className="text-center">
            <button
              onClick={() => router.push("/received/history")}
              className="text-slate-500 hover:text-slate-700 transition-colors px-4 py-2 rounded-lg hover:bg-slate-100"
            >
              返回收信列表
            </button>
          </div>
        </div>
      </main>

      {/* 抽卡详情弹窗 */}
      {selectedCard && (
        <CardDrawDialog
          open={!!selectedCard}
          onClose={() => setSelectedCard(null)}
          cardData={selectedCard}
        />
      )}

      <Footer />
    </div>
  );
}
