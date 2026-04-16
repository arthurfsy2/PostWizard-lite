'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crop, ImageIcon, Edit3, Check, AlertCircle, RefreshCw } from 'lucide-react';

interface EditLayoutProps {
  // 图片相关
  imageUrl?: string | null;
  processedImageUrl?: string | null;
  originalImageUrl?: string | null;
  onAdjustImage?: () => void;
  showAdjustButton?: boolean;

  // Postcard ID 相关
  postcardId?: string | null;
  postcardIdConfirmed?: boolean;
  onPostcardIdChange?: (id: string) => void;
  onPostcardIdConfirm?: () => void;
  onPostcardIdUnclear?: () => void;
  postcardIdUnclear?: boolean;

  // OCR 原文相关
  handwrittenText?: string | null;
  onHandwrittenTextChange?: (text: string) => void;
  detectedLang?: string | null;
  onReOcr?: () => Promise<void>;
  reOcrLoading?: boolean;

  // 中文翻译相关
  translatedText?: string | null;

  // 操作按钮
  onSave?: () => void;
  saving?: boolean;
  onCancel?: () => void;
  showReOcr?: boolean;

  // 自定义内容（插槽）
  children?: React.ReactNode;
  headerExtra?: React.ReactNode;
}

export function EditLayout({
  // 图片相关
  imageUrl,
  processedImageUrl,
  originalImageUrl,
  onAdjustImage,
  showAdjustButton = true,

  // Postcard ID 相关
  postcardId,
  postcardIdConfirmed = false,
  onPostcardIdChange,
  onPostcardIdConfirm,
  onPostcardIdUnclear,
  postcardIdUnclear = false,

  // OCR 原文相关
  handwrittenText,
  onHandwrittenTextChange,
  detectedLang,
  onReOcr,
  reOcrLoading = false,

  // 中文翻译相关
  translatedText,

  // 操作按钮
  onSave,
  saving = false,
  onCancel,
  showReOcr = true,

  // 自定义内容
  children,
  headerExtra,
}: EditLayoutProps) {
  // 使用处理后的图片优先，其次原图
  const displayImageUrl = processedImageUrl || imageUrl || originalImageUrl;

  // 图片放大查看
  const [showImageDialog, setShowImageDialog] = useState(false);

  return (
    <div className="bg-white/80 backdrop-blur-sm border-0 rounded-2xl shadow-lg p-8 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Edit3 className="w-6 h-6" />
            编辑明信片信息
          </h2>
          
          {/* Postcard ID 显示区域 */}
          {postcardId && (
            <div className="flex items-center gap-4 px-5 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg min-w-[280px]">
              <div className="flex-1">
                <div className="text-xs font-medium text-emerald-700">
                  Postcard ID
                </div>
                {postcardIdUnclear ? (
                  <input
                    type="text"
                    value={postcardId}
                    onChange={(e) => onPostcardIdChange?.(e.target.value)}
                    className="text-xl font-bold text-emerald-700 font-mono bg-white border border-emerald-300 rounded px-2 py-1 w-full focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="请输入正确的 ID"
                  />
                ) : (
                  <div className="text-xl font-bold text-emerald-700 font-mono">
                    {postcardId}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {postcardIdUnclear ? (
                  <button
                    onClick={onPostcardIdConfirm}
                    className="px-4 py-2 text-sm rounded-lg transition-all bg-emerald-500 text-white hover:bg-emerald-600"
                    title="保存"
                  >
                    保存
                  </button>
                ) : (
                  <>
                    <button
                      onClick={onPostcardIdConfirm}
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
                      onClick={onPostcardIdUnclear}
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

        <div className="flex items-center gap-2">
          {headerExtra}
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-gray-500 hover:text-gray-700 transition-colors px-4 py-2 rounded-lg hover:bg-gray-100 flex items-center gap-2"
            >
              <span>关闭</span>
            </button>
          )}
        </div>
      </div>

      {/* 三栏布局：图片 + 英文原文 + 中文翻译 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* 左栏：图片展示（固定高度，sticky） */}
        <div className="lg:sticky lg:top-6 lg:h-[600px] overflow-y-auto bg-white/80 backdrop-blur-sm border-0 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6">
          <h2 className="text-lg font-semibold mb-4">📷 明信片背面</h2>
          <div 
            className="relative h-full bg-gray-50 rounded-xl overflow-hidden border-2 border-gray-200 cursor-pointer"
            onClick={() => setShowImageDialog(true)}
          >
            {displayImageUrl ? (
              <img
                src={displayImageUrl}
                alt="明信片背面"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <ImageIcon className="w-12 h-12" />
              </div>
            )}
          </div>
          
          {showAdjustButton && onAdjustImage && (
            <div className="flex gap-2 mt-4">
              <button
                onClick={onAdjustImage}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all text-sm font-medium flex items-center justify-center gap-1"
              >
                <Crop className="w-4 h-4" />
                调整图片
              </button>
            </div>
          )}
          
          <p className="text-xs text-gray-500 mt-2">
            点击图片可放大查看细节
          </p>
        </div>

        {/* 中间：OCR 原文 */}
        <div className="bg-white/80 backdrop-blur-sm border-0 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className="text-xl">🇬🇧</span>
              英文原文
            </h2>
            {showReOcr && onReOcr && (
              <button
                onClick={onReOcr}
                disabled={reOcrLoading}
                className="text-sm px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-all flex items-center gap-1 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${reOcrLoading ? 'animate-spin' : ''}`} />
                重新识别
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-amber-50/80 rounded-xl p-4 min-h-[400px]">
              <textarea
                value={handwrittenText || ''}
                onChange={(e) => onHandwrittenTextChange?.(e.target.value)}
                className="w-full h-full bg-transparent border-0 resize-none focus:ring-0 text-gray-800 font-serif text-base leading-relaxed"
                placeholder="识别到的手写文字..."
                rows={20}
              />
            </div>
            
            <div className="flex items-center gap-2 text-amber-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>请仔细核对原文内容</span>
            </div>

            {detectedLang && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>检测语言：</span>
                <span className="px-2 py-1 bg-gray-100 rounded">{detectedLang}</span>
              </div>
            )}

            {/* 自定义插槽 */}
            {children}
          </div>
        </div>

        {/* 右栏：中文翻译 */}
        <div className="bg-white/80 backdrop-blur-sm border-0 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className="text-xl">🇨🇳</span>
              中文翻译
            </h2>
            <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">
              仅供参考
            </span>
          </div>

          <div className="space-y-4">
            <div className="bg-emerald-50/80 rounded-xl p-4 min-h-[400px]">
              <pre className="whitespace-pre-wrap text-gray-800 text-base leading-relaxed font-sans">
                {translatedText || '暂无翻译内容'}
              </pre>
            </div>
            
            <div className="flex items-center gap-2 text-emerald-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>AI 翻译，仅供参考</span>
            </div>
          </div>
        </div>
      </div>

      {/* 底部操作按钮 */}
      <div className="flex items-center justify-end gap-3 pt-6 border-t">
        {onSave && (
          <button
            onClick={onSave}
            disabled={saving}
            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 transition-all shadow-lg shadow-orange-500/25 hover:shadow-xl"
          >
            {saving ? '保存中...' : '保存修改'}
          </button>
        )}
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all"
          >
            取消
          </button>
        )}
      </div>

      {/* 图片放大对话框 */}
      <AnimatePresence>
        {showImageDialog && displayImageUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowImageDialog(false)}
          >
            <div className="relative max-w-5xl max-h-[90vh]">
              <img
                src={displayImageUrl}
                alt="明信片背面 - 放大查看"
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
              />
              <button
                onClick={() => setShowImageDialog(false)}
                className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
              >
                <span className="text-2xl">✕</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default EditLayout;
