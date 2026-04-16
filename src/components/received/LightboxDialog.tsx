"use client";

import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, ZoomIn, ZoomOut, Maximize, Minimize } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LightboxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
}

export default function LightboxDialog({ open, onOpenChange, imageUrl }: LightboxDialogProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const contentRef = useRef<HTMLDivElement>(null);

  // 重置缩放和位置
  useEffect(() => {
    if (open) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [open]);

  // 处理滚轮缩放
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((prev) => Math.min(Math.max(prev + delta, 1), 5));
  };

  // 处理鼠标按下（开始拖拽）
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  // 处理鼠标移动（拖拽中）
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  // 处理鼠标释放（结束拖拽）
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 处理鼠标离开（结束拖拽）
  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  // 缩放控制
  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.5, 5));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.5, 1));
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // 键盘事件（ESC 关闭）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    };

    if (open) {
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[95vh] bg-black/95 border-0 p-0 gap-0">
        {/* 顶部工具栏 */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          {/* 缩放控制 */}
          <div className="flex items-center gap-1 bg-white/10 backdrop-blur-sm rounded-lg p-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomOut}
              disabled={scale <= 1}
              className="h-8 w-8 text-white hover:bg-white/20 disabled:opacity-30"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-white text-xs font-medium px-2 min-w-[48px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomIn}
              disabled={scale >= 5}
              className="h-8 w-8 text-white hover:bg-white/20 disabled:opacity-30"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>

          {/* 重置按钮 */}
          {scale > 1 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleReset}
              className="h-8 w-8 text-white hover:bg-white/20"
            >
              <Minimize className="w-4 h-4" />
            </Button>
          )}

          {/* 关闭按钮 */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 text-white hover:bg-white/20"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* 图片容器 */}
        <div
          ref={contentRef}
          className="w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          <img
            src={imageUrl}
            alt="明信片背面"
            className="max-w-none select-none"
            style={{
              transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`,
              transformOrigin: "center center",
              transition: isDragging ? "none" : "transform 0.2s ease-out",
            }}
            draggable={false}
          />
        </div>

        {/* 底部提示 */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-xs">
          滚动鼠标滚轮缩放 • 拖拽移动 • ESC 关闭
        </div>
      </DialogContent>
    </Dialog>
  );
}
