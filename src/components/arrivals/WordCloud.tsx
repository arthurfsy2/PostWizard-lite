'use client';

import { useEffect, useRef, useState } from 'react';

// 词云配色方案 - Viridis 调色板
const WORDCLOUD_COLORS = [
  '#440154', '#482878', '#3e4989', '#31688e', '#26828e',
  '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde725',
];

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

interface WordCloudProps {
  data: WordCloudData;
  width?: number;
  height?: number;
  onWordClick?: (word: WordCloudWord) => void;
  showExport?: boolean; // 是否显示导出按钮
}

/**
 * 词云组件 - 使用 wordcloud2.js 渲染 Canvas
 */
export function WordCloud({
  data,
  width = 1000,
  height = 500,
  onWordClick,
  showExport = true
}: WordCloudProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !canvasRef.current || !data.words.length) return;

    const initWordCloud = async () => {
      const WordCloud2 = (await import('wordcloud')).default;
      
      if (!canvasRef.current) return;

      // 准备数据格式: [['word', weight], ...]
      const wordList = data.words.map(w => [w.text, w.weight] as [string, number]);
      
      // 计算字体大小范围
      const weights = data.words.map(w => w.weight);
      const maxWeight = Math.max(...weights);
      const minWeight = Math.min(...weights);
      
      // 根据词数量调整字体大小
      const wordCount = data.words.length;
      const maxFontSize = Math.min(80, Math.max(40, wordCount * 1.5));
      const minFontSize = Math.max(12, maxFontSize * 0.15);

      // 设置 Canvas 尺寸（高清屏适配）
      const canvas = canvasRef.current;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }

      // 渲染词云
      WordCloud2(canvas, {
        list: wordList,
        gridSize: Math.round(16 * (width / 1000)), // 根据宽度调整网格大小
        origin: [width / 2, height / 2], // 设置原点为画布中心
        weightFactor: (size: number) => {
          // 线性映射权重到字体大小
          if (maxWeight === minWeight) return (maxFontSize + minFontSize) / 2;
          return minFontSize + ((size - minWeight) / (maxWeight - minWeight)) * (maxFontSize - minFontSize);
        },
        fontFamily: '"Noto Serif TC", "Noto Serif SC", "Microsoft JhengHei", serif',
        fontWeight: 'bold',
        color: (_word: string, _weight: number, _fontSize: number, _distance: number, theta: number) => {
          // 根据角度选择颜色，实现渐变效果
          const colorIndex = Math.floor((theta / (2 * Math.PI)) * WORDCLOUD_COLORS.length) % WORDCLOUD_COLORS.length;
          return WORDCLOUD_COLORS[colorIndex];
        },
        rotateRatio: 0, // 禁用旋转
        rotationSteps: 0,
        // shape: 'circle', // 圆形（默认）
        backgroundColor: 'transparent',
        drawOutOfBound: false,
        shrinkToFit: true, // 自动缩小以适应
        minSize: 8, // 最小字体大小
        click: (item: [string, number]) => {
          if (item && onWordClick) {
            const [text, weight] = item;
            onWordClick({ text, weight });
          }
        },
        hover: (_item: [string, number], _dimension: unknown, event: MouseEvent) => {
          if (canvasRef.current) {
            canvasRef.current.style.cursor = 'pointer';
          }
        },
      });
    };

    initWordCloud();
  }, [data, width, height, isClient, onWordClick]);

  // 导出图片功能
  const handleExport = () => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = `wordcloud-${data.language}-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  if (!data.words.length) {
    return (
      <div
        className="flex items-center justify-center bg-white rounded-lg"
        style={{ width, height }}
      >
        <p className="text-slate-400 text-sm">暂无数据</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="relative flex items-center justify-center"
      style={{ width: '100%', height: '100%', minHeight: height }}
    >
      {showExport && data.words.length > 0 && (
        <button
          onClick={handleExport}
          className="absolute top-2 right-2 z-10 px-3 py-1.5 text-xs bg-white/90 hover:bg-white text-slate-600 hover:text-slate-800 rounded-md shadow-sm border border-slate-200 transition-colors"
          title="导出 PNG 图片"
        >
          导出 PNG
        </button>
      )}
      <canvas
        ref={canvasRef}
        className="cursor-pointer"
        style={{
          display: 'block',
          margin: '0 auto',
          maxWidth: '100%',
          maxHeight: '100%',
        }}
      />
    </div>
  );
}
