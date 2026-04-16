'use client';

import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Loader2 } from 'lucide-react';

interface ListItemCardProps {
  leftIcon?: ReactNode;
  leftGradient?: string;  // 默认 'from-orange-100 to-amber-100'
  title: string;
  subtitle?: string;
  rightTop?: ReactNode;
  rightBottom?: string;
  bottomLeft?: ReactNode;
  bottomRight?: ReactNode;  // 按钮区域
  isLoading?: boolean;
  loadingText?: string;
  onClick?: () => void;
}

export function ListItemCard({
  leftIcon,
  leftGradient = 'from-orange-100 to-amber-100',
  title,
  subtitle,
  rightTop,
  rightBottom,
  bottomLeft,
  bottomRight,
  isLoading = false,
  loadingText = '加载中...',
  onClick,
}: ListItemCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.01, x: 4 }}
      whileTap={{ scale: 0.99 }}
      className="relative"
    >
      <button
        onClick={onClick}
        disabled={isLoading}
        className={`
          w-full text-left rounded-xl border transition-all duration-200
          ${isLoading 
            ? 'bg-slate-50 border-slate-200 cursor-not-allowed' 
            : 'bg-white border-slate-200 hover:border-orange-300 hover:shadow-md cursor-pointer'
          }
          p-4 group
        `}
      >
        <div className="flex items-start justify-between gap-4">
          {/* 左侧：图标 + 主标题/副标题 */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* 左侧图标 */}
            {leftIcon && (
              <div className={`flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${leftGradient} flex items-center justify-center shadow-sm`}>
                {leftIcon}
              </div>
            )}

            {/* 标题信息 */}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-slate-800 text-base truncate">
                {title}
              </h4>
              {subtitle && (
                <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                  <span className="truncate">{subtitle}</span>
                </p>
              )}
            </div>
          </div>

          {/* 右侧：顶部 + 底部信息 */}
          {(rightTop || rightBottom) && (
            <div className="flex-shrink-0 text-right">
              {rightTop && (
                <div className="font-mono text-sm font-medium text-slate-700 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                  {rightTop}
                </div>
              )}
              {rightBottom && (
                <div className="flex items-center justify-end gap-1 text-xs text-slate-400 mt-1.5">
                  <span>{rightBottom}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部：左侧信息 + 右侧按钮 */}
        {(bottomLeft || bottomRight) && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              {bottomLeft}
            </div>
            
            <div className={`
              flex items-center text-sm font-medium transition-colors
              ${isLoading ? 'text-slate-400' : 'text-orange-500 group-hover:text-orange-600'}
            `}>
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-slate-200 border-t-orange-500 rounded-full animate-spin" />
                  <span>{loadingText}</span>
                </div>
              ) : (
                bottomRight || (
                  <>
                    <span>查看详情</span>
                    <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )
              )}
            </div>
          </div>
        )}

        {/* 加载遮罩 - 毛玻璃特效 */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm rounded-xl pointer-events-none flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
              <span className="text-sm text-slate-600 font-medium">{loadingText}</span>
            </div>
          </div>
        )}
      </button>
    </motion.div>
  );
}
