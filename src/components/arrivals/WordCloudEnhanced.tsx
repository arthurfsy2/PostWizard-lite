'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

// === 现代渐变色板（从 demo 提取） ===
const COLOR_PALETTES = {
  // 霓虹东方（默认）
  neon: ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#f368e0'],
  // 科技前沿
  tech: ['#43e97b', '#38f9d7', '#fa709a', '#fee140', '#a18cd1', '#fbc2eb'],
  // 水墨丹青
  ink: ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#1abc9c', '#e84393'],
  // 烟火璀璨
  firework: ['#fd79a8', '#fdcb6e', '#6c5ce7', '#00cec9', '#e17055', '#74b9ff', '#a29bfe', '#55efc4'],
};

type ShapeType = 'circle' | 'diamond' | 'star' | 'triangle-forward';

interface WordCloudWord {
  text: string;
  weight: number;
  count?: number;
}

interface WordCloudData {
  words: WordCloudWord[];
  totalWords: number;
  uniqueWords?: number;
  language: string;
  generatedAt?: string;
}

interface WordCloudEnhancedProps {
  data: WordCloudData;
  onWordClick?: (word: WordCloudWord) => void;
  showExport?: boolean;
}

// === 自定义五边形形状函数（从繁体 demo 提取） ===
function pentagonShape(theta: number): number {
  const sides = 5;
  const angle = (2 * Math.PI) / sides;
  const idx = Math.floor((theta + Math.PI / 2) / angle);
  const a1 = idx * angle - Math.PI / 2;
  const a2 = a1 + angle;
  const r1x = Math.cos(a1), r1y = Math.sin(a1);
  const r2x = Math.cos(a2), r2y = Math.sin(a2);
  const cx = Math.cos(theta), cy = Math.sin(theta);
  const denom = r1x * r2y - r2x * r1y;
  if (Math.abs(denom) < 1e-10) return 1;
  const t = (cx * r2y - r2x * cy) / denom;
  return Math.min(Math.max(t, 0.3), 1);
}

export function WordCloudEnhanced({
  data,
  onWordClick,
  showExport = true,
}: WordCloudEnhancedProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);
  const [selectedShape, setSelectedShape] = useState<ShapeType>('circle');
  const [selectedPalette, setSelectedPalette] = useState<keyof typeof COLOR_PALETTES>('neon');
  const [hoveredWord, setHoveredWord] = useState<WordCloudWord | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // 渲染词云
  const renderWordCloud = useCallback(async () => {
    if (!isClient || !canvasRef.current || !data.words.length) return;

    setIsGenerating(true);
    const WordCloud2 = (await import('wordcloud')).default;
    
    if (!canvasRef.current) {
      setIsGenerating(false);
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsGenerating(false);
      return;
    }

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 准备数据格式
    const wordList = data.words.map(w => [w.text, w.weight] as [string, number]);
    
    // 计算字体大小范围
    const weights = data.words.map(w => w.weight);
    const maxWeight = Math.max(...weights);
    const minWeight = Math.min(...weights);
    
    // 动态字体大小（从 demo 提取）
    const wordCount = data.words.length;
    const maxFontSize = Math.min(74, Math.max(40, wordCount * 1.5));
    const minFontSize = Math.max(11, maxFontSize * 0.15);

    // 设置 Canvas 尺寸（高清屏适配）
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 900 * dpr;
    canvas.height = 560 * dpr;
    canvas.style.width = '900px';
    canvas.style.height = '560px';
    ctx.scale(dpr, dpr);

    // 获取当前色板
    const palette = COLOR_PALETTES[selectedPalette];

    // 形状配置
    const shapeConfig = {
      circle: { shape: 'circle' as const, ellipticity: 0.72 },
      diamond: { shape: 'diamond' as const, ellipticity: 1 },
      star: { shape: 'star' as const, ellipticity: 0.85 },
      'triangle-forward': { shape: 'triangle-forward' as const, ellipticity: 0.8 },
    };

    const { shape, ellipticity } = shapeConfig[selectedShape];

    // 自定义五边形
    const actualShape = selectedShape === 'pentagon' ? pentagonShape : shape;

    // 渲染词云
    WordCloud2(canvas, {
      list: wordList,
      gridSize: 4, // 固定网格大小（从 demo 提取）
      origin: [450, 280], // 中心点
      
      // 字体大小映射（从 demo 提取的线性映射）
      weightFactor: (size: number) => {
        if (maxWeight === minWeight) return (maxFontSize + minFontSize) / 2;
        return minFontSize + ((size - minWeight) / (maxWeight - minWeight)) * (maxFontSize - minFontSize);
      },

      // 字体（支持中英文）
      fontFamily: '"Noto Sans TC", "Noto Sans SC", "Microsoft JhengHei", "PingFang SC", sans-serif',
      fontWeight: '700',

      // 颜色函数（从 demo 提取的随机色板）
      color: (word: string) => {
        const idx = Math.floor(Math.random() * palette.length);
        return palette[idx];
      },

      backgroundColor: 'transparent',
      
      // 形状配置
      shape: actualShape,
      ellipticity,

      // 旋转配置（默认关闭）
      minRotation: 0,
      maxRotation: 0,
      rotateRatio: 0,

      // 排列策略（大词优先）
      shuffle: false,
      drawOutOfBound: false,
      shrinkToFit: true,
      minSize: 8,

      // 点击事件
      click: (item: [string, number]) => {
        if (item && onWordClick) {
          const [text, weight] = item;
          onWordClick({ text, weight, count: weight });
        }
      },

      // Hover 事件（显示 Tooltip）
      hover: (item: [string, number] | null, _dimension: unknown, event: MouseEvent) => {
        if (item) {
          const [text, weight] = item;
          setHoveredWord({ text, weight, count: weight });
          setTooltipPosition({ x: event.clientX + 16, y: event.clientY + 16 });
          canvas.style.cursor = 'pointer';
        } else {
          setHoveredWord(null);
          canvas.style.cursor = 'default';
        }
      },
    });

    // 生成完成
    setTimeout(() => {
      setIsGenerating(false);
    }, 1500);
  }, [data, isClient, selectedShape, selectedPalette, onWordClick]);

  // 数据变化时重新渲染
  useEffect(() => {
    if (isClient && data.words.length > 0) {
      renderWordCloud();
    }
  }, [data, isClient, renderWordCloud]);

  // 导出图片
  const handleExport = () => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = `wordcloud-${data.language}-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // 形状按钮配置
  const shapeButtons: { id: ShapeType; emoji: string; label: string }[] = [
    { id: 'circle', emoji: '⭕', label: '圆形' },
    { id: 'diamond', emoji: '💎', label: '菱形' },
    { id: 'star', emoji: '⭐', label: '星形' },
    { id: 'triangle-forward', emoji: '▶', label: '三角' },
  ];

  // 色板按钮配置
  const paletteButtons: { id: keyof typeof COLOR_PALETTES; label: string }[] = [
    { id: 'neon', label: '霓虹' },
    { id: 'tech', label: '科技' },
    { id: 'ink', label: '水墨' },
    { id: 'firework', label: '烟火' },
  ];

  if (!data.words.length) {
    return (
      <div className="flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl" style={{ minHeight: 400 }}>
        <p className="text-slate-400 text-sm">暂无数据</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="space-y-4">
      {/* === 控制按钮组（从 demo 提取） === */}
      <div className="flex flex-wrap gap-2 justify-center">
        {/* 形状切换 */}
        <div className="flex flex-wrap gap-2">
          {shapeButtons.map((btn) => (
            <button
              key={btn.id}
              onClick={() => setSelectedShape(btn.id)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg transition-all duration-300 border',
                selectedShape === btn.id
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white border-transparent shadow-lg scale-105'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300 hover:shadow-md'
              )}
            >
              <span className="mr-1">{btn.emoji}</span>
              <span className="hidden sm:inline">{btn.label}</span>
            </button>
          ))}
        </div>

        {/* 分隔线 */}
        <div className="w-px h-8 bg-slate-200 mx-2" />

        {/* 色板切换 */}
        <div className="flex flex-wrap gap-2">
          {paletteButtons.map((btn) => (
            <button
              key={btn.id}
              onClick={() => setSelectedPalette(btn.id)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg transition-all duration-300 border',
                selectedPalette === btn.id
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white border-transparent shadow-lg scale-105'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300 hover:shadow-md'
              )}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* === 词云容器（从 demo 提取的精美样式） === */}
      <div className="relative">
        {/* 渐变背景容器 */}
        <div
          className={cn(
            'relative rounded-2xl overflow-hidden shadow-2xl transition-all duration-500',
            'bg-gradient-to-br from-[#0a0a1a] via-[#12122a] to-[#1a1a3e]',
            'border border-white/10',
            'shadow-[0_0_80px_rgba(123,47,247,0.15),0_0_120px_rgba(0,210,255,0.05)]'
          )}
        >
          {/* 光晕效果层 */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at 40% 45%, rgba(67,233,123,0.08) 0%, transparent 65%)',
            }}
          />

          {/* Canvas 容器 */}
          <div className="relative z-10 flex items-center justify-center p-4">
            <canvas
              ref={canvasRef}
              className="cursor-pointer"
              style={{
                display: 'block',
                maxWidth: '100%',
                maxHeight: '100%',
              }}
            />
          </div>

          {/* 加载状态 */}
          {isGenerating && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm z-20">
              <div className="flex items-center gap-3 text-white">
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span className="text-sm font-medium">正在生成词云...</span>
              </div>
            </div>
          )}

          {/* 导出按钮 */}
          {showExport && !isGenerating && (
            <button
              onClick={handleExport}
              className="absolute top-4 right-4 z-20 px-3 py-1.5 text-xs bg-white/90 hover:bg-white text-slate-600 hover:text-slate-800 rounded-lg shadow-lg border border-slate-200 transition-all duration-300 hover:scale-105"
              title="导出 PNG 图片"
            >
              📷 导出 PNG
            </button>
          )}
        </div>

        {/* === 精美 Tooltip（从简体中文 demo 提取） === */}
        {hoveredWord && (
          <div
            className="fixed z-50 pointer-events-none animate-in fade-in duration-200"
            style={{
              left: tooltipPosition.x,
              top: tooltipPosition.y,
            }}
          >
            <div
              className={cn(
                'bg-slate-900/95 backdrop-blur-md',
                'border border-purple-500/50 rounded-xl',
                'px-4 py-3 shadow-[0_6px_30px_rgba(123,47,247,0.3)]',
                'text-white min-w-[140px]'
              )}
            >
              {/* 词汇 */}
              <div className="text-base font-bold text-purple-300 mb-1">
                {hoveredWord.text}
              </div>
              
              {/* 权重进度条 */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, (hoveredWord.weight / Math.max(...data.words.map(w => w.weight))) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  {hoveredWord.weight}
                </span>
              </div>
              
              {/* 词频 */}
              {hoveredWord.count && (
                <div className="text-xs text-slate-500 mt-1">
                  出现 {hoveredWord.count} 次
                </div>
              )}
            </div>
          </div>
        )}
      </div>


    </div>
  );
}
