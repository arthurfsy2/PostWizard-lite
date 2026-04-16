'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface ProgressBarProps {
  progress: number; // 0-100
  label?: string;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'default' | 'success' | 'warning' | 'info';
  animated?: boolean;
}

const SIZE_CLASSES = {
  sm: 'h-2',
  md: 'h-3',
  lg: 'h-4',
};

const COLOR_CLASSES = {
  default: 'from-orange-400 to-orange-500',
  success: 'from-emerald-400 to-emerald-500',
  warning: 'from-yellow-400 to-yellow-500',
  info: 'from-blue-400 to-blue-500',
};

export function ProgressBar({
  progress,
  label,
  showPercentage = true,
  size = 'md',
  color = 'default',
  animated = true,
}: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="w-full">
      {/* 标签和百分比 */}
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-2">
          {label && (
            <span className="text-sm font-medium text-gray-700">{label}</span>
          )}
          {showPercentage && (
            <span className="text-sm font-bold text-gray-900">
              {clampedProgress}%
            </span>
          )}
        </div>
      )}

      {/* 进度条 */}
      <div className={`
        w-full bg-gray-200 rounded-full overflow-hidden
        ${SIZE_CLASSES[size]}
      `}>
        <motion.div
          className={`
            h-full rounded-full bg-gradient-to-r ${COLOR_CLASSES[color]}
            ${animated ? 'transition-all duration-1000 ease-out' : ''}
          `}
          initial={{ width: 0 }}
          animate={{ width: `${clampedProgress}%` }}
          transition={animated ? { duration: 1, ease: 'easeOut' } : undefined}
        >
          {/* 闪光效果 */}
          {animated && clampedProgress > 0 && (
            <motion.div
              className="h-full w-full"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
              }}
              animate={{
                x: ['-100%', '100%'],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatDelay: 1,
              }}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
}

// 分类进度展示组件
interface CategoryProgressProps {
  categories: {
    key: string;
    name: string;
    completed: boolean;
    hint?: string;
  }[];
}

export function CategoryProgress({ categories }: CategoryProgressProps) {
  return (
    <div className="space-y-3">
      {categories.map((category) => (
        <div
          key={category.key}
          className={`
            flex items-center justify-between p-3 rounded-lg border
            ${category.completed 
              ? 'bg-emerald-50 border-emerald-200' 
              : 'bg-gray-50 border-gray-200'
            }
          `}
        >
          <div className="flex items-center gap-3">
            <div className={`
              w-6 h-6 rounded-full flex items-center justify-center
              ${category.completed 
                ? 'bg-emerald-500 text-white' 
                : 'bg-gray-300 text-gray-500'
              }
            `}>
              {category.completed ? '✓' : '○'}
            </div>
            <div>
              <span className={`
                font-medium
                ${category.completed ? 'text-emerald-700' : 'text-gray-600'}
              `}>
                {category.name}
              </span>
              {category.hint && !category.completed && (
                <p className="text-xs text-gray-400 mt-0.5">{category.hint}</p>
              )}
            </div>
          </div>
          {category.completed && (
            <span className="text-xs text-emerald-600 font-medium">已完成</span>
          )}
        </div>
      ))}
    </div>
  );
}
