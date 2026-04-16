"use client";

import { useState, useEffect } from "react";
import { ZoomIn, ImageOff, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import LightboxDialog from "./LightboxDialog";

interface ImageViewerProps {
  imageUrl: string | null;
  onImageLoad?: () => void;
  onError?: () => void;
  containerHeight?: string; // 容器高度，默认 h-64 md:h-80 lg:h-96，设为 'auto' 时自适应
}

export default function ImageViewer({ imageUrl, onImageLoad, onError, containerHeight = 'h-64 md:h-80 lg:h-96' }: ImageViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // 调试日志：接收到的 imageUrl
  // console.log('[ImageViewer] Received imageUrl:', imageUrl);
  // console.log('[ImageViewer] imageUrl is null/undefined:', !imageUrl);
  // console.log('[ImageViewer] Current loading state:', loading);
  // console.log('[ImageViewer] Will render img element:', !!imageUrl && !loading && !error);

  // 图片加载完成处理
  const handleImageLoad = () => {
    // console.log('[ImageViewer] Image loaded successfully:', imageUrl);
    // console.log('[ImageViewer] Setting loading to false');
    setLoading(false);
    setError(false);
    onImageLoad?.();
  };

  // 图片加载失败处理
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    // console.error('[ImageViewer] Image loading failed:', imageUrl);
    // console.error('[ImageViewer] Error event:', e);
    // console.error('[ImageViewer] Image src:', (e.target as HTMLImageElement).src);
    // console.log('[ImageViewer] Setting loading to false, error to true');
    setLoading(false);
    setError(true);
    onError?.(e);
  };

  // 图片已经在缓存中的处理 - 使用 useEffect 强制检查
  useEffect(() => {
    if (imageUrl && loading) {
      // console.log('[ImageViewer] useEffect: Checking if image is already cached');
      const img = new Image();
      img.src = imageUrl;
      
      // 检查图片是否已缓存
      if (img.complete && img.naturalWidth > 0) {
        // console.log('[ImageViewer] Image already cached, setting loading to false');
        setLoading(false);
        setError(false);
        onImageLoad?.();
      } else {
        // console.log('[ImageViewer] Image not cached, waiting for load/error event');
        img.onload = () => {
          // console.log('[ImageViewer] Cached image onload');
          setLoading(false);
          setError(false);
        };
        img.onerror = () => {
          // console.error('[ImageViewer] Cached image onerror');
          setLoading(false);
          setError(true);
        };
      }
    }
  }, [imageUrl, loading, onImageLoad]);

  const handleRetry = () => {
    // console.log('[ImageViewer] Retrying image load:', imageUrl);
    setError(false);
    setLoading(true);
  };

  if (!imageUrl) {
    // console.warn('[ImageViewer] No imageUrl provided, rendering empty state');
    const heightClass = containerHeight === 'auto' ? 'min-h-[200px]' : containerHeight;
    return (
      <div className={`w-full ${heightClass} bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl flex items-center justify-center border-2 border-dashed border-orange-200`}>
        <div className="text-center p-6">
          <ImageOff className="w-16 h-16 text-orange-300 mx-auto mb-3" />
          <p className="text-sm text-orange-700 font-medium">暂无图片</p>
          <p className="text-xs text-orange-500 mt-1">请先上传明信片背面照片</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="relative group">
        {/* 图片容器 - 根据 containerHeight 参数决定高度 */}
        <div className={`relative w-full ${containerHeight === 'auto' ? 'min-h-[200px] lg:min-h-[400px]' : containerHeight} bg-white rounded-2xl overflow-hidden shadow-lg border-2 border-orange-100 group-hover:border-orange-300 transition-all duration-300`}>
          {/* 加载状态 */}
          {loading && (
            <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50`}>
              <Skeleton className="w-full h-full" />
            </div>
          )}

          {/* 错误状态 */}
          {error && (
            <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50`}>
              <div className="text-center p-6">
                <ImageOff className="w-16 h-16 text-orange-300 mx-auto mb-3" />
                <p className="text-sm text-orange-700 mb-3 font-medium">图片加载失败</p>
                <button
                  onClick={handleRetry}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm text-orange-700 bg-white hover:bg-orange-50 rounded-lg transition-colors shadow-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  重试
                </button>
              </div>
            </div>
          )}

          {/* 图片显示 - 优化竖向图片显示 */}
          {!loading && !error && (
            <div className={`relative w-full ${containerHeight === 'auto' ? '' : 'h-full'} bg-gradient-to-br from-gray-50 to-gray-100`}>
              <img
                src={imageUrl || ''}
                alt="明信片背面"
                className={`w-full ${containerHeight === 'auto' ? 'h-auto' : 'h-full'} object-contain transition-all duration-300 group-hover:scale-[1.02]`}
                onLoad={handleImageLoad}
                onError={handleImageError}
                crossOrigin="anonymous"
              />
              {imageUrl && (
                <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 text-white text-xs rounded">
                  图片 URL: {imageUrl.substring(0, 30)}...
                </div>
              )}
              
              {/* 放大提示覆盖层 - 优化视觉效果 */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end justify-center pb-6">
                <button
                  onClick={() => setLightboxOpen(true)}
                  className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:scale-105"
                >
                  <ZoomIn className="w-5 h-5" />
                  放大查看细节
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 底部提示文字 - 优化样式 */}
        {!loading && !error && (
          <div className="flex items-center justify-center gap-2 mt-3 text-xs text-gray-500 bg-orange-50/50 px-3 py-2 rounded-lg">
            <span className="text-orange-500">💡</span>
            <span>点击图片可放大查看细节</span>
          </div>
        )}
      </div>

      {/* 全屏图片查看器 */}
      <LightboxDialog
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        imageUrl={imageUrl}
      />
    </>
  );
}
