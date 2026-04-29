"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import CardDrawDialog, {
  type CardData,
} from "@/components/cards/CardDrawDialog";
import { UploadProgressIndicator } from "@/components/received/UploadProgressIndicator";
import { motion, AnimatePresence } from "framer-motion";
import { useGacha } from "@/hooks/useGacha";
import {
  Camera,
  Upload,
  X,
  ImageIcon,
  Scan,
  Edit3,
  RefreshCw,
  Crown,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import ImageViewer from "@/components/received/ImageViewer";

// 获取维度图标
function getDimensionIcon(name: string): string {
  const iconMap: Record<string, string> = {
    内容详实度: "📝",
    文化价值: "🏛️",
    个人故事: "💭",
    语言表达: "❤️",
    情感表达: "❤️",
  };
  return iconMap[name] || "✨";
}

interface Template {
  id: string;
  name: string;
  nameEn?: string;
  thumbnail: string;
  isPremium: boolean;
  locked?: boolean;
}

interface CardDataExtended {
  id: string;
  postcardId?: string;
  postcardIdConfirmed?: boolean;
  senderUsername?: string;
  senderCountry?: string;
  senderCity?: string;
  handwrittenText?: string;
  translatedText?: string;
  detectedLang?: string;
  ocrConfidence?: number;
  backImageUrl?: string;
  frontImageUrl?: string;
  isOcrManualEdit: boolean;
}

export default function UploadPage() {
  const router = useRouter();
  const { token, user, isLoading, isAuthenticated } = useAuth();
  const { draw, loading: gachaLoading, error: gachaError } = useGacha(token);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // 3 步流程状态
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  // Step 1: 上传相关状态
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);

  // Step 2: 抽卡相关状态
  const [showCardDraw, setShowCardDraw] = useState(false);
  const [drawCardData, setDrawCardData] = useState<CardData | null>(null);
  const [cardId, setCardId] = useState<string | null>(null);

  // Step 3: 编辑相关状态
  const [cardData, setCardData] = useState<CardDataExtended | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [formData, setFormData] = useState({
    postcardId: "",
    senderUsername: "",
    senderCountry: "",
    senderCity: "",
    handwrittenText: "",
  });
  const [postcardIdConfirmed, setPostcardIdConfirmed] = useState(false);
  const [postcardIdUnclear, setPostcardIdUnclear] = useState(false);
  const [reOcrLoading, setReOcrLoading] = useState(false);
  // 重复确认对话框状态
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<any>(null);
  const [pendingSaveData, setPendingSaveData] = useState<any>(null);

  const handleFileSelect = useCallback((file: File) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/heic",
      "image/webp",
    ];
    if (!allowedTypes.includes(file.type)) {
      setError("不支持的文件格式，请上传 JPG/PNG/HEIC/WEBP 格式");
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError("文件大小超过 10MB 限制");
      return;
    }

    setError(null);
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("请选择要上传的图片");
      return;
    }

    if (!token) {
      setError("请先登录后再上传");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("backImage", selectedFile);

      const response = await fetch("/api/received-cards", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        // 处理重复检测（409 Conflict）
        if (response.status === 409 && data.error === 'DUPLICATE_POSTCARD_ID') {
          // 显示确认对话框
          setDuplicateInfo(data.duplicateInfo);
          setPendingSaveData({
            ...data,
            step: 'upload', // 标记是上传阶段的重复
          });
          setShowDuplicateDialog(true);
          setUploading(false);
          return;
        }
        
        if (data.error === "OCR_QUOTA_EXCEEDED") {
          setError("本月免费 OCR 次数已用完，请升级订阅");
          router.push("/donate");
          return;
        }
        throw new Error(data.error || "上传失败");
      }

      // 保存 cardId 用于后续编辑
      setCardId(data.id);
      // 保存上传成功的图片 URL（优先使用 API 返回的 URL）
      setUploadedImageUrl(data.backImageUrl || previewUrl);

      // 调用抽卡 API
      let ocrContent =
        data.handwrittenText || data.ocrText || data.content || "";
      // console.log('[Upload] OCR content:', ocrContent?.substring(0, 100));
      // console.log('[Upload] OCR content length:', ocrContent?.length || 0);

      // 如果 OCR 内容太短，使用 fallback 文本
      if (!ocrContent || ocrContent.length < 5) {
        // console.warn('[Upload] OCR content too short, using fallback text');
        ocrContent = `来自${data.senderCountry || "未知国家"}${data.senderCity || ""}的明信片，期待您的收藏！`;
        // console.log('[Upload] Using fallback:', ocrContent);
      }

      const gachaResult = await draw(
        data.postcardId || data.id, // 优先用 OCR 识别的 postcardId
        ocrContent,
        previewUrl || undefined,
      );

      if (!gachaResult) {
        throw new Error(gachaError || "抽卡失败，请稍后重试");
      }

      // 转换后端数据格式为前端格式
      const cardData: CardData = {
        id: data.id,
        imageUrl: gachaResult.imageUrl,
        userImageUrl: previewUrl || undefined,
        title: gachaResult.cardName,
        description: gachaResult.description,
        rarity: gachaResult.rarity,
        luckyLevel: gachaResult.luckyLevel,
        luckyBonus: gachaResult.luckyBonus,
        aiEvaluation: {
          summary: gachaResult.aiEvaluation.summary,
          dimensions: gachaResult.aiEvaluation.dimensions.map((dim: any) => ({
            label: dim.name,
            score: Math.round(dim.score / 10), // 后端 0-100 转前端 0-10
            icon: getDimensionIcon(dim.name),
          })),
          reasons: gachaResult.aiEvaluation.dimensions.map(
            (dim: any) => `${dim.name}: ${dim.reason}`,
          ),
          overallScore: gachaResult.aiEvaluation.overallScore / 10, // 后端 0-100 转前端 0-10
        },
      };

      setDrawCardData(cardData);
      setShowCardDraw(true);

      // 进入 Step 2
      setCurrentStep(2);
      setCompletedSteps([1]);
    } catch (err: any) {
      // console.error('Upload failed:', err);
      setError(err.message || "上传失败，请重试");
    } finally {
      setUploading(false);
    }
  };

  // 抽卡对话框关闭 - 进入 Step 3
  const handleCardDrawClose = useCallback(async () => {
    setShowCardDraw(false);

    // 加载卡片数据用于编辑
    if (cardId && token) {
      try {
        // console.log("[Step3] Loading card data, cardId:", cardId);
        // console.log(
        //   "[Step3] Current previewUrl:",
        //   previewUrl ? "exists" : "null",
        // );

        const response = await fetch(`/api/received-cards/${cardId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();


          setCardData(data);
          setFormData({
            postcardId: data.postcardId || "",
            senderUsername: data.senderUsername || "",
            senderCountry: data.senderCountry || "",
            senderCity: data.senderCity || "",
            handwrittenText: data.handwrittenText || "",
          });
          setPostcardIdConfirmed(data.postcardIdConfirmed || false);
          setPostcardIdUnclear(!data.postcardId);

          // 进入 Step 3
          setCurrentStep(3);
          setCompletedSteps([1, 2]);

          // console.log("[Step3] CardData set, backImageUrl:", data.backImageUrl);
          // console.log(
          //   "[Step3] ImageViewer will receive:",
          //   data.backImageUrl || previewUrl,
          // );
        } else {
          // console.error(
          //   "[Step3] API response not ok, status:",
          //   response.status,
          // );
        }
      } catch (error) {
        // console.error("[Step3] Failed to load card:", error);
      }
    } else {
      // console.warn("[Step3] Missing cardId or token:", {
      //   cardId,
      //   token: !!token,
      // });
    }
  }, [cardId, token, previewUrl]);

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  // 返回上一步
  const handleBackToStep1 = () => {
    setCurrentStep(1);
    setCompletedSteps([]);
    clearSelection();
  };

  const handleBackToStep2 = () => {
    setCurrentStep(2);
    setCompletedSteps([1]);
  };

  // 加载模板列表
  const loadTemplates = useCallback(async () => {
    try {
      const response = await fetch("/api/templates");
      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      }
    } catch (error) {
      // console.error('Failed to load templates:', error);
    }
  }, []);

  // 重新 OCR
  const handleReOcr = async () => {
    if (!cardId || !token) return;

    setReOcrLoading(true);
    try {
      const response = await fetch(`/api/received-cards/${cardId}/re-ocr`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCardData(data);
        setFormData({
          postcardId: data.postcardId || "",
          senderUsername: data.senderUsername || "",
          senderCountry: data.senderCountry || "",
          senderCity: data.senderCity || "",
          handwrittenText: data.handwrittenText || "",
        });
      }
    } catch (error) {
      // console.error('Re-OCR failed:', error);
    } finally {
      setReOcrLoading(false);
    }
  };

  // 保存编辑
  const handleSave = async (overwrite = false) => {
    if (!cardId || !token || !cardData) return;

    // 如果没有 Postcard ID，直接保存
    if (!formData.postcardId) {
      await saveCardData(overwrite);
      return;
    }

    // 先检测是否重复（主动检测）
    if (!overwrite) {
      try {
        const checkResponse = await fetch(`/api/received-cards/check-duplicate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            postcardId: formData.postcardId,
            currentCardId: cardId, // 排除当前记录
          }),
        });

        if (checkResponse.status === 409) {
          const data = await checkResponse.json();
          // 发现重复，显示确认对话框
          setDuplicateInfo(data.duplicateInfo);
          setPendingSaveData({
            postcardId: formData.postcardId,
            senderUsername: formData.senderUsername,
            senderCountry: formData.senderCountry,
            senderCity: formData.senderCity,
            handwrittenText: formData.handwrittenText,
            postcardIdConfirmed,
          });
          setShowDuplicateDialog(true);
          return;
        }
      } catch (error) {
        // console.error('Duplicate check failed:', error);
        // 检测失败，继续保存流程
      }
    }

    // 无重复或用户确认覆盖，执行保存
    await saveCardData(overwrite);
  };

  // 实际保存逻辑
  const saveCardData = async (overwrite = false) => {
    setGenerating(true);
    try {
      const body: any = {
        postcardId: formData.postcardId,
        senderUsername: formData.senderUsername,
        senderCountry: formData.senderCountry,
        senderCity: formData.senderCity,
        handwrittenText: formData.handwrittenText,
        postcardIdConfirmed,
      };

      // 如果是覆盖操作，添加确认标记
      if (overwrite) {
        body.allowOverwrite = true;
      }

      const response = await fetch(`/api/received-cards/${cardId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        alert("保存成功！");
        router.push("/received/history");
      } else {
        const data = await response.json();
        alert("保存失败：" + (data.error || "未知错误"));
      }
    } catch (error) {
      // console.error('Save failed:', error);
      alert("保存失败，请重试");
    } finally {
      setGenerating(false);
    }
  };

  // 处理覆盖确认
  const handleOverwriteConfirm = async () => {
    setShowDuplicateDialog(false);
    
    if (pendingSaveData?.step === 'upload') {
      // 上传阶段的重复：删除旧记录 + 重新上传（带覆盖标记，跳过重复检测）
      const duplicateCardId = pendingSaveData.duplicateCardId;
      
      try {
        // 1. 先删除旧记录
        const deleteResponse = await fetch(`/api/received-cards/${duplicateCardId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        if (!deleteResponse.ok) {
          const errorData = await deleteResponse.json();
          throw new Error(errorData.error || '删除旧记录失败');
        }
        
        // 2. 重新上传（删除后不会再触发重复检测）
        await handleUpload();
        
      } catch (error: any) {
        setError(error.message || "覆盖处理失败，请重试");
      }
    } else if (pendingSaveData) {
      // Step 3 保存阶段的重复
      handleSave(true); // 传递 overwrite=true
    }
  };

  // 处理取消覆盖
  const handleOverwriteCancel = () => {
    setShowDuplicateDialog(false);
    setPendingSaveData(null);
    setDuplicateInfo(null);
    // 如果是上传阶段取消，清空选择
    if (pendingSaveData?.step === 'upload') {
      setSelectedFile(null);
      setPreviewUrl(null);
      setError(null);
    }
  };

  // 加载中时不显示内容（开源版无需登录检查）
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-orange-50/30 flex items-center justify-center">
        <div className="absolute top-20 left-20 w-64 h-64 bg-orange-200/40 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-48 h-48 bg-blue-200/30 rounded-full blur-3xl"></div>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-orange-50/30 relative overflow-hidden">
      <Header />

      <main className="py-12 px-4">
        {/* 装饰球 */}
        <div className="absolute top-20 left-20 w-64 h-64 bg-orange-200/40 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-48 h-48 bg-blue-200/30 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 right-1/4 w-40 h-40 bg-amber-100/50 rounded-full blur-2xl"></div>

        <div className="max-w-4xl mx-auto relative z-10">
          {/* Header */}
          <section className="relative mb-8 overflow-hidden">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-emerald-200/40 to-teal-200/40 rounded-full blur-3xl" />
              <div className="absolute top-1/3 -left-40 w-80 h-80 bg-gradient-to-tr from-amber-200/30 to-orange-200/30 rounded-full blur-3xl" />
            </div>
            <div className="relative">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-center">
                <span className="text-slate-900">AI 智能收信识别</span>
                <span className="mx-2 text-slate-300">|</span>
                <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 bg-clip-text text-transparent">
                  3步轻松收藏
                </span>
              </h1>
            </div>
          </section>

          {/* 进度指示器 */}
          <UploadProgressIndicator
            currentStep={currentStep}
            completedSteps={completedSteps}
          />

          {/* Step 1: 上传图片 */}
          <AnimatePresence>
            {currentStep === 1 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="bg-white/80 backdrop-blur-sm border-0 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-8 mb-6">
                  <div
                    className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${
                      isDragging
                        ? "border-orange-500 bg-orange-50"
                        : "border-gray-300 hover:border-orange-400"
                    }`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                  >
                    {previewUrl ? (
                      <div className="space-y-4">
                        <div className="relative inline-block">
                          <img
                            src={previewUrl}
                            alt="Preview"
                            className="max-h-64 mx-auto rounded-lg shadow-md"
                          />
                          <button
                            onClick={clearSelection}
                            className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-md"
                            title="重新选择"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="text-6xl">📷</div>
                        <div>
                          <p className="text-lg font-medium text-gray-700 mb-2">
                            拖拽图片到此处
                          </p>
                          <p className="text-sm text-gray-500 mb-6">
                            或选择以下方式上传
                          </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                          <button
                            onClick={handleFileClick}
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-500/25 hover:shadow-xl hover:-translate-y-0.5"
                          >
                            <ImageIcon className="w-5 h-5" />
                            选择图片
                          </button>

                          <button
                            onClick={handleCameraClick}
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                          >
                            <Camera className="w-5 h-5" />
                            拍照上传
                          </button>
                        </div>

                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/heic,image/webp"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileSelect(file);
                          }}
                          className="hidden"
                        />
                        <input
                          ref={cameraInputRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileSelect(file);
                          }}
                          className="hidden"
                        />

                        <p className="text-xs text-gray-400">
                          支持 JPG/PNG/HEIC/WEBP 格式，最大 10MB
                        </p>
                      </div>
                    )}
                  </div>

                  {error && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
                      <span className="text-xl">⚠️</span>
                      {error}
                    </div>
                  )}

                  {selectedFile && (
                    <button
                      onClick={handleUpload}
                      disabled={uploading || gachaLoading}
                      className="w-full mt-6 px-6 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25"
                    >
                      {uploading || gachaLoading ? (
                        <>
                          <svg
                            className="animate-spin h-5 w-5"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          {gachaLoading ? "正在抽卡..." : "正在识别中..."}
                        </>
                      ) : (
                        <>
                          <Upload className="w-5 h-5" />
                          上传并识别
                        </>
                      )}
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step 2: 抽卡结果（通过对话框显示） */}
          {showCardDraw && drawCardData && (
            <CardDrawDialog
              open={showCardDraw}
              onClose={handleCardDrawClose}
              cardData={drawCardData}
            />
          )}

          {/* Step 3: 编辑完善 */}
          <AnimatePresence>
            {currentStep === 3 && cardData && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="bg-white/80 backdrop-blur-sm border-0 rounded-2xl shadow-lg p-8 mb-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Edit3 className="w-6 h-6" />
                        编辑明信片信息
                      </h2>
                      {/* Postcard ID 显示区域 */}
                      {cardData.postcardId && (
                        <div className="flex items-center gap-4 px-5 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg min-w-[280px]">
                          <div className="flex-1">
                            <div className="text-xs font-medium text-emerald-700">
                              Postcard ID
                            </div>
                            {postcardIdUnclear ? (
                              <input
                                type="text"
                                value={formData.postcardId}
                                onChange={(e) =>
                                  setFormData({ ...formData, postcardId: e.target.value })
                                }
                                className="text-xl font-bold text-emerald-700 font-mono bg-white border border-emerald-300 rounded px-2 py-1 w-full focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                placeholder="请输入正确的 ID"
                              />
                            ) : (
                              <div className="text-xl font-bold text-emerald-700 font-mono">
                                {cardData.postcardId}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {postcardIdUnclear ? (
                              <button
                                onClick={() => {
                                  setPostcardIdUnclear(false);
                                  setPostcardIdConfirmed(true);
                                }}
                                className="px-4 py-2 text-sm rounded-lg transition-all bg-emerald-500 text-white hover:bg-emerald-600"
                                title="保存"
                              >
                                保存
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => setPostcardIdConfirmed(true)}
                                  className={`px-4 py-2 text-sm rounded-lg transition-all ${
                                    postcardIdConfirmed
                                      ? "bg-emerald-500 text-white"
                                      : "bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200"
                                  }`}
                                  title="确认"
                                >
                                  ✓ 确认
                                </button>
                                <button
                                  onClick={() => setPostcardIdUnclear(true)}
                                  className={`px-3 py-2 text-sm rounded-lg transition-all ${
                                    postcardIdUnclear
                                      ? "bg-amber-500 text-white"
                                      : "bg-white text-amber-700 hover:bg-amber-50 border border-amber-200"
                                  }`}
                                  title="看不清"
                                >
                                  看不清
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handleBackToStep2}
                      className="text-gray-500 hover:text-gray-700 transition-colors px-4 py-2 rounded-lg hover:bg-gray-100 flex items-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      关闭
                    </button>
                  </div>

                  {/* 三栏布局：图片 + 英文原文 + 中文翻译 */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    {/* 左栏：图片展示（固定高度，桌面端 sticky） */}
                    <div className="lg:sticky lg:top-6 lg:h-[450px] overflow-y-auto">
                      <ImageViewer
                        imageUrl={
                          cardData?.backImageUrl ||
                          uploadedImageUrl ||
                          previewUrl
                        }
                        containerHeight="h-[400px] lg:h-[400px]" // 固定高度
                        onImageLoad={() => {
                          const url = cardData?.backImageUrl || uploadedImageUrl || previewUrl;
                        }}
                        onError={(e) => {
                          const url = cardData?.backImageUrl || uploadedImageUrl || previewUrl;
                        }}
                      />
                      {/* 图片提示 */}
                      <p className="text-xs text-gray-500 mt-2 text-center">
                        💡 点击图片可放大查看
                      </p>
                    </div>

                    {/* 中栏：英文原文（可编辑） */}
                    <div className="flex flex-col">
                      <div className="flex flex-col h-full p-4 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 border-2 border-amber-200 rounded-xl relative shadow-sm">
                        <div className="flex items-center justify-between mb-2 flex-shrink-0">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">✍️</span>
                            <label className="text-sm font-semibold text-amber-900">
                              英文原文
                            </label>
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                              需确认
                            </span>
                          </div>
                          <button
                            onClick={handleReOcr}
                            disabled={reOcrLoading}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                          >
                            <RefreshCw className={`w-3 h-3 ${reOcrLoading ? "animate-spin" : ""}`} />
                            {reOcrLoading ? "识别中..." : "重新识别"}
                          </button>
                        </div>
                        <textarea
                          value={formData.handwrittenText}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              handwrittenText: e.target.value,
                            })
                          }
                          className="flex-1 w-full px-4 py-3 bg-white/80 border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none text-gray-800 leading-relaxed"
                          placeholder="请核对并编辑识别出的手写内容..."
                          style={{ minHeight: "200px" }}
                        />
                        <p className="mt-2 text-xs text-amber-600 flex items-center gap-1 flex-shrink-0">
                          <span>💡</span>
                          请仔细核对原文内容
                        </p>
                      </div>
                    </div>

                    {/* 右栏：中文翻译（参考） */}
                    <div className="flex flex-col">
                      {cardData.translatedText ? (
                        <div className="flex flex-col h-full p-4 bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-200 rounded-xl relative shadow-sm">
                          <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                            <span className="text-lg">🇨</span>
                            <label className="text-sm font-semibold text-emerald-900">
                              中文翻译
                            </label>
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                              仅供参考
                            </span>
                          </div>
                          <div className="flex-1 w-full px-4 py-3 bg-white/80 border border-emerald-200 rounded-xl text-gray-700 leading-relaxed overflow-y-auto" style={{ minHeight: "200px" }}>
                            {cardData.translatedText}
                          </div>
                          <p className="mt-2 text-xs text-emerald-600 flex items-center gap-1 flex-shrink-0">
                            <span>🤖</span>
                            AI 翻译，仅供参考
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col h-full p-4 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl relative shadow-sm items-center justify-center text-center">
                          <span className="text-4xl mb-2">🤖</span>
                          <p className="text-sm text-gray-500">暂无翻译</p>
                          <p className="text-xs text-gray-400 mt-1">AI 将自动生成翻译</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 中英文对比提示 */}
                  <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-sm text-blue-700">
                    <span>💡</span>
                    <span>左右对照查看：左侧为英文原文（可编辑），右侧为中文翻译（参考）</span>
                  </div>

                  {/* 寄件人信息（折叠） */}
                  <details className="mb-6 group">
                    <summary className="flex items-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors select-none">
                      <span className="text-lg">👤</span>
                      <span className="font-medium text-gray-700">
                        寄件人信息（可选填）
                      </span>
                      <span className="ml-auto text-gray-400 group-open:rotate-180 transition-transform">
                        ▼
                      </span>
                    </summary>
                    <div className="pt-4 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          寄件人用户名
                        </label>
                        <input
                          type="text"
                          value={formData.senderUsername}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              senderUsername: e.target.value,
                            })
                          }
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          placeholder="例如：Alice"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            国家/地区
                          </label>
                          <input
                            type="text"
                            value={formData.senderCountry}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                senderCountry: e.target.value,
                              })
                            }
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            placeholder="例如：Germany"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            城市
                          </label>
                          <input
                            type="text"
                            value={formData.senderCity}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                senderCity: e.target.value,
                              })
                            }
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            placeholder="例如：Berlin"
                          />
                        </div>
                      </div>
                    </div>
                  </details>

                  {/* 底部操作按钮 */}
                  <div className="flex items-center justify-center pt-4 border-t border-gray-200">
                    <button
                      onClick={handleSave}
                      disabled={generating}
                      className="px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-medium transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-orange-500/25 text-lg"
                    >
                      {generating ? (
                        <>
                          <svg
                            className="animate-spin h-5 w-5"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          保存中...
                        </>
                      ) : (
                        <>
                          <Upload className="w-5 h-5" />
                          保存到卡册
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Back Link */}
          <div className="mt-8 text-center">
            <button
              onClick={() => router.push("/received/history")}
              className="text-gray-500 hover:text-gray-700 transition-colors px-4 py-2 rounded-lg hover:bg-gray-100"
            >
              ← 返回收信列表
            </button>
          </div>
        </div>
      </main>

      {/* 重复确认对话框 */}
      {showDuplicateDialog && duplicateInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                <span className="text-2xl">⚠️</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">明信片 ID 已存在</h3>
                <p className="text-sm text-gray-500">该明信片已在 {duplicateInfo.formattedTime} 收录过</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">明信片 ID</span>
                <span className="font-mono font-bold text-amber-600">{duplicateInfo.postcardId}</span>
              </div>
            </div>

            <div className="mb-4 text-slate-700 text-sm">
              <p>选择"覆盖"将更新该明信片的解析结果，保留原收藏记录。</p>
              <p>选择"取消"将放弃本次上传。</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleOverwriteCancel}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-all"
              >
                取消
              </button>
              <button
                onClick={handleOverwriteConfirm}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-medium transition-all shadow-lg"
              >
                覆盖记录
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
