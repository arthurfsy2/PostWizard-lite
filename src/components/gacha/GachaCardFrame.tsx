"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Rarity, getRarityColors, RARITY_LABELS } from "@/lib/constants/rarity";

interface GachaCardFrameProps {
  rarity: Rarity;
  children: React.ReactNode;
  className?: string;
  viewMode?: "grid" | "list";
  showBadge?: boolean;
}

/**
 * 稀有度卡牌框架组件
 * 
 * 视觉规范参考: docs/design/RECEIVED_CARD_RARITY_DESIGN.md
 * 
 * 提供带稀有度边框样式的卡片容器：
 * - SSR: 金色渐变边框 + 闪烁动画 + 呼吸光晕
 * - SR: 银色渐变边框 + 微光流动
 * - R: 铜色/琥珀色边框
 * - N: 灰色边框
 * - null: 普通白色卡片
 */
export function GachaCardFrame({
  rarity,
  children,
  className,
  viewMode = "grid",
  showBadge = true,
}: GachaCardFrameProps) {
  const isSSR = rarity === "SSR";
  const isSR = rarity === "SR";
  const isR = rarity === "R";
  const isN = rarity === "N";

  // 边框样式映射（根据设计规范 7.2）
  const borderClasses: Record<string, string> = {
    SSR: "rarity-border-ssr bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50",
    SR: "rarity-border-sr bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100",
    R: "rarity-border-r bg-gradient-to-br from-amber-50 to-orange-50",
    N: "border border-gray-200 bg-gray-50",
    default: "border border-gray-200 bg-white",
  };

  const borderClass = rarity ? borderClasses[rarity] || borderClasses.default : borderClasses.default;

  // 光晕效果（根据设计规范 2.4）
  const glowClasses: Record<string, string> = {
    SSR: "shadow-[0_0_20px_rgba(255,215,0,0.4),0_0_40px_rgba(255,165,0,0.2)] animate-ssr-glow",
    SR: "shadow-[0_0_15px_rgba(192,192,192,0.3)]",
    R: "shadow-[0_0_10px_rgba(205,127,50,0.2)]",
    N: "shadow-sm",
    default: "",
  };

  const glowClass = rarity ? glowClasses[rarity] || glowClasses.default : glowClasses.default;

  // 视图模式尺寸
  const viewModeClasses = {
    grid: "rounded-lg",
    list: "rounded-md flex flex-row",
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden transition-all duration-300",
        "hover:-translate-y-1",
        borderClass,
        glowClass,
        viewModeClasses[viewMode],
        className
      )}
      data-rarity={rarity || "default"}
      data-view-mode={viewMode}
    >
      {/* SSR 呼吸光晕动画层 */}
      {isSSR && viewMode === "grid" && (
        <div className="absolute inset-0 pointer-events-none animate-ssr-pulse" />
      )}

      {/* SR 微光流动边框效果 */}
      {isSR && viewMode === "grid" && (
        <div className="absolute inset-0 pointer-events-none rarity-sr-shimmer" />
      )}

      {/* SSR 星尘粒子特效 */}
      {isSSR && viewMode === "grid" && <StardustEffect />}

      {/* 内容区域 */}
      <div className={cn(
        "relative z-10 h-full",
        viewMode === "list" && "flex items-center"
      )}>
        {children}
      </div>

      {/* 稀有度角标 */}
      {showBadge && rarity && (
        <RarityBadge rarity={rarity} viewMode={viewMode} />
      )}
    </div>
  );
}

/**
 * 稀有度角标组件
 * 位置：右上角，距边缘 8px
 * 尺寸：网格 36×20px，列表 32×18px
 */
function RarityBadge({ 
  rarity, 
  viewMode 
}: { 
  rarity: Exclude<Rarity, null>;
  viewMode: "grid" | "list";
}) {
  // 角标样式（根据设计规范 4.3）
  const badgeClasses: Record<string, string> = {
    SSR: "bg-gradient-to-br from-amber-400 via-yellow-500 to-orange-500 text-white border-amber-100 shadow-lg",
    SR: "bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 text-gray-700 border-white shadow-md",
    R: "bg-gradient-to-br from-amber-600 to-amber-700 text-white border-amber-200 shadow-md",
    N: "bg-gradient-to-br from-gray-100 to-gray-200 text-gray-500 border-gray-300",
  };

  // 尺寸：网格 36×20px，列表 32×18px
  const sizeClasses = {
    grid: "px-2 py-0.5 text-[10px] min-w-[36px] h-5",
    list: "px-1.5 py-0 text-[9px] min-w-[32px] h-[18px]",
  };

  return (
    <div
      className={cn(
        "absolute z-20 font-bold rounded border",
        "top-2 right-2", // 距边缘 8px
        "flex items-center justify-center",
        "transition-transform hover:scale-105",
        badgeClasses[rarity],
        sizeClasses[viewMode]
      )}
    >
      {rarity}
    </div>
  );
}

/**
 * SSR 星尘粒子特效
 * 3-5个小星星，位置随机分布，闪烁动画
 */
function StardustEffect() {
  const stars = [
    { left: "85%", top: "10%", delay: "0s", size: 6 },
    { left: "75%", top: "20%", delay: "0.3s", size: 4 },
    { left: "90%", top: "25%", delay: "0.6s", size: 5 },
    { left: "80%", top: "8%", delay: "0.9s", size: 4 },
    { left: "88%", top: "15%", delay: "1.2s", size: 3 },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {stars.map((star, i) => (
        <div
          key={i}
          className="absolute rounded-full animate-ssr-sparkle"
          style={{
            left: star.left,
            top: star.top,
            width: star.size,
            height: star.size,
            background: "linear-gradient(135deg, #FFF8DC, #FFD700)",
            boxShadow: "0 0 4px rgba(255, 215, 0, 0.8)",
            animationDelay: star.delay,
          }}
        />
      ))}
    </div>
  );
}

export default GachaCardFrame;
