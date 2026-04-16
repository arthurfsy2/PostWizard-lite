'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { BadgeGrid } from './BadgeGrid';
import { ProgressBar, CategoryProgress } from './ProgressBar';
import { AchievementUnlockModal } from './AchievementUnlockModal';
import { Badge, MaterialProgress, CategoryProgress as CategoryProgressType } from '@/lib/badge/types';
import { MATERIAL_CATEGORIES } from '@/lib/badge/types';
import { Trophy, Target, Star, Zap } from 'lucide-react';

// 进度响应数据类型
interface ProgressData {
  progress: MaterialProgress;
  badges: { badge: Badge; unlockedAt: string; isNew: boolean }[];
  nextAchievements: {
    badge: Badge;
    currentProgress: number;
    requiredProgress: number;
    percentage: number;
  }[];
}

export function BadgeSystem() {
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [data, setData] = useState<ProgressData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unlockedBadge, setUnlockedBadge] = useState<Badge | null>(null);
  const [showModal, setShowModal] = useState(false);

  // 获取进度数据
  const fetchProgress = useCallback(async () => {
    try {
      const response = await fetch('/api/materials/progress');
      if (!response.ok) throw new Error('获取进度失败');
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, []);

  // 检查成就
  const checkAchievements = async () => {
    setChecking(true);
    try {
      const response = await fetch('/api/materials/check-achievements', {
        method: 'POST',
      });
      if (!response.ok) throw new Error('检查成就失败');
      const result = await response.json();
      
      if (result.success) {
        setData((prev) => ({
          ...result.data,
          progress: prev?.progress || result.data.progress,
        }));

        // 显示新解锁的徽章
        if (result.data.unlockedThisTime?.length > 0) {
          const firstUnlock = result.data.unlockedThisTime[0];
          setUnlockedBadge(firstUnlock.badge);
          setShowModal(true);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setChecking(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  // 自动检查成就（组件挂载时）
  useEffect(() => {
    if (!loading && data) {
      checkAchievements();
    }
  }, [loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-lg">
        <p>加载失败: {error}</p>
        <button
          onClick={fetchProgress}
          className="mt-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
        >
          重试
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { progress, badges, nextAchievements } = data;
  const categoryProgress = progress.categoryProgress || {
    self_intro: false,
    hobbies: false,
    hometown: false,
    travel_stories: false,
    fun_facts: false,
  };

  // 构建分类进度数据
  const categoryData = MATERIAL_CATEGORIES.map((cat) => ({
    key: cat.key,
    name: cat.name,
    completed: categoryProgress[cat.key as keyof CategoryProgressType] || false,
    hint: cat.description,
  }));

  // 所有徽章定义
  const allBadges = [
    ...(badges.map((b) => b.badge) || []),
    ...(nextAchievements.map((n) => n.badge) || []),
  ];
  // 去重
  const uniqueBadges = Array.from(new Map(allBadges.map((b) => [b.id, b])).values());

  return (
    <div className="space-y-8">
      {/* 头部统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard
          icon={<Trophy className="w-6 h-6 text-yellow-500" />}
          title="已解锁徽章"
          value={badges?.length || 0}
          total={5}
          color="yellow"
        />
        <StatsCard
          icon={<Target className="w-6 h-6 text-blue-500" />}
          title="完善度"
          value={`${progress.completionRate}%`}
          subtitle={`${Math.round(progress.completionRate / 20)}/5 分类`}
          color="blue"
        />
        <StatsCard
          icon={<Star className="w-6 h-6 text-purple-500" />}
          title="质量评分"
          value={`${progress.qualityScore}/5`}
          subtitle="基于内容丰富度"
          color="purple"
        />
        <StatsCard
          icon={<Zap className="w-6 h-6 text-green-500" />}
          title="素材使用"
          value={`${progress.totalMatches}次`}
          subtitle="成功匹配次数"
          color="green"
        />
      </div>

      {/* 完善度进度 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
      >
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-orange-500" />
          素材完善进度
        </h3>
        <ProgressBar
          progress={progress.completionRate}
          label="总体完善度"
          size="lg"
          color={progress.completionRate >= 100 ? 'success' : 'default'}
        />
        <div className="mt-6">
          <CategoryProgress categories={categoryData} />
        </div>
      </motion.div>

      {/* 下一个目标 */}
      {nextAchievements && nextAchievements.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
        >
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-purple-500" />
            下一个目标
          </h3>
          <div className="space-y-4">
            {nextAchievements.slice(0, 2).map((next) => (
              <div key={next.badge.id} className="flex items-center gap-4">
                <div className="text-3xl">{next.badge.icon}</div>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="font-medium text-gray-800">{next.badge.name}</span>
                    <span className="text-sm text-gray-500">
                      {next.currentProgress}/{next.requiredProgress}
                    </span>
                  </div>
                  <ProgressBar
                    progress={next.percentage}
                    size="sm"
                    showPercentage={false}
                    color={next.percentage >= 100 ? 'success' : 'info'}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* 徽章展示 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            成就徽章
          </h3>
          <button
            onClick={checkAchievements}
            disabled={checking}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            {checking ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                检查中...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                检查新成就
              </>
            )}
          </button>
        </div>
        <BadgeGrid
          badges={uniqueBadges}
          userBadges={badges || []}
          onBadgeClick={(badge) => { /* // console.log('点击徽章:', badge) */ }}
        />
      </motion.div>

      {/* 成就解锁弹窗 */}
      <AchievementUnlockModal
        badge={unlockedBadge}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </div>
  );
}

// 统计卡片组件
interface StatsCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  total?: number;
  subtitle?: string;
  color: 'yellow' | 'blue' | 'purple' | 'green';
}

function StatsCard({ icon, title, value, total, subtitle, color }: StatsCardProps) {
  const colorClasses = {
    yellow: 'bg-yellow-50 border-yellow-200',
    blue: 'bg-blue-50 border-blue-200',
    purple: 'bg-purple-50 border-purple-200',
    green: 'bg-green-50 border-green-200',
  };

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`p-4 rounded-xl border ${colorClasses[color]} flex items-center gap-4`}
    >
      <div className="p-3 bg-white rounded-xl shadow-sm">{icon}</div>
      <div>
        <p className="text-sm text-gray-600">{title}</p>
        <p className="text-2xl font-bold text-gray-800">
          {value}
          {total !== undefined && (
            <span className="text-sm font-normal text-gray-400">/{total}</span>
          )}
        </p>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
    </motion.div>
  );
}
