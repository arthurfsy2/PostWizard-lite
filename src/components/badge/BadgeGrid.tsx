'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { BadgeCard } from './BadgeCard';
import { Badge, UserBadge } from '@/lib/badge/types';

interface BadgeGridProps {
  badges: Badge[];
  userBadges: UserBadge[];
  onBadgeClick?: (badge: Badge) => void;
}

export function BadgeGrid({ badges, userBadges, onBadgeClick }: BadgeGridProps) {
  // 构建已解锁徽章的映射
  const unlockedMap = new Map(
    userBadges.map((ub) => [ub.badgeId, ub])
  );

  // 按排序顺序排列徽章
  const sortedBadges = [...badges].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {sortedBadges.map((badge, index) => {
        const userBadge = unlockedMap.get(badge.id);
        const isUnlocked = !!userBadge;
        const isNew = userBadge?.isNew ?? false;

        return (
          <motion.div
            key={badge.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <BadgeCard
              badge={badge}
              isUnlocked={isUnlocked}
              isNew={isNew}
              unlockedAt={userBadge?.unlockedAt}
              onClick={() => onBadgeClick?.(badge)}
            />
          </motion.div>
        );
      })}
    </div>
  );
}
