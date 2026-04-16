'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge, BADGE_TIER_STYLES } from '@/lib/badge/types';
import { Sparkles, Gift, Crown } from 'lucide-react';

interface AchievementUnlockModalProps {
  badge: Badge | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AchievementUnlockModal({
  badge,
  isOpen,
  onClose,
}: AchievementUnlockModalProps) {
  // 自动关闭
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  if (!badge) return null;

  const styles = BADGE_TIER_STYLES[badge.tier];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -50 }}
            transition={{ type: 'spring', damping: 15 }}
            className="relative bg-white rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 装饰性背景 */}
            <div className="absolute inset-0 overflow-hidden rounded-3xl">
              <div className={`absolute -top-20 -right-20 w-40 h-40 rounded-full bg-gradient-to-br ${styles.bgGradient} opacity-20`} />
              <div className={`absolute -bottom-20 -left-20 w-40 h-40 rounded-full bg-gradient-to-br ${styles.bgGradient} opacity-20`} />
            </div>

            {/* 内容 */}
            <div className="relative text-center">
              {/* 解锁标题 */}
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex items-center justify-center gap-2 mb-4"
              >
                <Sparkles className="w-6 h-6 text-yellow-500" />
                <span className="text-xl font-bold text-gray-800">解锁新成就!</span>
                <Sparkles className="w-6 h-6 text-yellow-500" />
              </motion.div>

              {/* 徽章图标 */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
                className="mb-6"
              >
                <div className={`
                  inline-flex items-center justify-center w-28 h-28 rounded-full
                  bg-gradient-to-br ${styles.bgGradient} shadow-xl
                  text-6xl relative
                `}>
                  {badge.icon}
                  
                  {/* 光环效果 */}
                  <motion.div
                    className={`absolute inset-0 rounded-full border-4 border-yellow-400`}
                    animate={{ scale: [1, 1.2, 1], opacity: [0.8, 0, 0.8] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>
              </motion.div>

              {/* 徽章信息 */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <h3 className={`text-2xl font-bold mb-2 ${styles.textColor}`}>
                  {badge.name}
                </h3>
                <p className="text-gray-600 mb-4">{badge.description}</p>

                {/* 奖励信息 */}
                {(badge.quotaReward > 0 || badge.daysReward > 0) && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="flex items-center justify-center gap-4 mb-6"
                  >
                    {badge.quotaReward > 0 && (
                      <div className="flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full">
                        <Gift className="w-5 h-5" />
                        <span className="font-bold">+{badge.quotaReward} 额度</span>
                      </div>
                    )}
                    {badge.daysReward > 0 && (
                      <div className="flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full">
                        <Crown className="w-5 h-5" />
                        <span className="font-bold">+{badge.daysReward} 天会员</span>
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>

              {/* 关闭按钮 */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                onClick={onClose}
                className={`
                  px-8 py-3 rounded-full font-bold text-white
                  bg-gradient-to-r ${styles.bgGradient}
                  hover:shadow-lg transform hover:scale-105 transition-all
                `}
              >
                太棒了!
              </motion.button>
            </div>
          </motion.div>

          {/* 彩带效果 */}
          <Confetti />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// 简单的彩带效果
function Confetti() {
  const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'];
  
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: 50 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full"
          style={{
            backgroundColor: colors[i % colors.length],
            left: `${Math.random() * 100}%`,
            top: -10,
          }}
          animate={{
            y: ['0vh', '100vh'],
            x: [0, (Math.random() - 0.5) * 200],
            rotate: [0, Math.random() * 360],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 2,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  );
}
