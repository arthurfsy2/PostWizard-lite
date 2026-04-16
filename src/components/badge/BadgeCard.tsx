'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Badge, BadgeTier, BADGE_TIER_STYLES } from '@/lib/badge/types';

interface BadgeCardProps {
  badge: Badge;
  isUnlocked: boolean;
  isNew?: boolean;
  unlockedAt?: string;
  onClick?: () => void;
  showDetails?: boolean;
}

// 徽章等级显示名称
const TIER_NAMES: Record<BadgeTier, string> = {
  bronze: '铜徽章',
  silver: '银徽章',
  gold: '金徽章',
  special: '特别徽章',
};

export function BadgeCard({
  badge,
  isUnlocked,
  isNew = false,
  unlockedAt,
  onClick,
  showDetails = true,
}: BadgeCardProps) {
  const styles = BADGE_TIER_STYLES[badge.tier];

  return (
    <motion.div
      whileHover={isUnlocked ? { scale: 1.05, y: -4 } : {}}
      whileTap={isUnlocked ? { scale: 0.98 } : {}}
      onClick={onClick}
      className={`
        relative p-4 rounded-xl border-2 transition-all duration-300 cursor-pointer
        ${isUnlocked 
          ? `bg-gradient-to-br ${styles.bgGradient} ${styles.borderColor} shadow-lg ${styles.glowColor}` 
          : 'bg-gray-100 border-gray-200 grayscale opacity-60'
        }
        ${isNew ? 'ring-4 ring-yellow-400 ring-offset-2 animate-pulse' : ''}
      `}
    >
      {/* 新徽章标记 */}
      {isNew && (
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
          NEW
        </div>
      )}

      {/* 徽章图标 */}
      <div className="flex flex-col items-center">
        <div className={`
          w-16 h-16 rounded-full flex items-center justify-center text-4xl mb-3
          ${isUnlocked 
            ? 'bg-white/90 shadow-inner' 
            : 'bg-gray-200'
          }
        `}>
          {badge.icon}
        </div>

        {/* 徽章名称 */}
        <h3 className={`
          font-bold text-center mb-1
          ${isUnlocked ? styles.textColor : 'text-gray-500'}
        `}>
          {badge.name}
        </h3>

        {/* 徽章等级 */}
        <span className={`
          text-xs font-medium px-2 py-0.5 rounded-full mb-2
          ${isUnlocked 
            ? 'bg-white/70 ' + styles.textColor 
            : 'bg-gray-200 text-gray-400'
          }
        `}>
          {TIER_NAMES[badge.tier]}
        </span>

        {/* 详细描述 */}
        {showDetails && (
          <>
            <p className="text-sm text-center text-gray-600 mb-2 line-clamp-2">
              {badge.description}
            </p>

            {/* 解锁条件 */}
            <div className="text-xs text-gray-500 text-center bg-white/50 rounded-lg px-2 py-1 w-full">
              <span className="font-medium">解锁条件:</span> {badge.condition}
            </div>

            {/* 奖励信息 */}
            {(badge.quotaReward > 0 || badge.daysReward > 0) && isUnlocked && (
              <div className="flex gap-2 mt-2">
                {badge.quotaReward > 0 && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    +{badge.quotaReward}额度
                  </span>
                )}
                {badge.daysReward > 0 && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    +{badge.daysReward}天会员
                  </span>
                )}
              </div>
            )}

            {/* 解锁时间 */}
            {unlockedAt && (
              <p className="text-xs text-gray-400 mt-2">
                解锁于 {new Date(unlockedAt).toLocaleDateString('zh-CN')}
              </p>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
