import { prisma } from '@/lib/prisma';
import {
  Badge,
  BadgeType,
  UserBadge,
  MaterialProgress,
  BadgeUnlockResult,
  CategoryProgress,
  DEFAULT_BADGES,
} from './types';

// 初始化系统徽章
export async function initializeBadges(): Promise<void> {
  for (const badge of DEFAULT_BADGES) {
    await prisma.badge.upsert({
      where: { key: badge.key },
      update: {
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        tier: badge.tier,
        condition: badge.condition,
        quotaReward: badge.quotaReward,
        daysReward: badge.daysReward,
        sortOrder: badge.sortOrder,
      },
      create: {
        key: badge.key,
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        tier: badge.tier,
        condition: badge.condition,
        quotaReward: badge.quotaReward,
        daysReward: badge.daysReward,
        sortOrder: badge.sortOrder,
        isActive: true,
      },
    });
  }
}

// 获取或创建用户素材进度
export async function getOrCreateMaterialProgress(userId: string): Promise<MaterialProgress> {
  let progress = await prisma.materialProgress.findUnique({
    where: { userId },
  });

  if (!progress) {
    progress = await prisma.materialProgress.create({
      data: {
        userId,
        completionRate: 0,
        qualityScore: 0,
        categoryProgress: JSON.stringify({
          self_intro: false,
          hobbies: false,
          hometown: false,
          travel_stories: false,
          fun_facts: false,
        }),
        totalMatches: 0,
      },
    });
  }

  return {
    ...progress,
    categoryProgress: JSON.parse(progress.categoryProgress || '{}'),
  };
}

// 更新素材完善度
export async function updateMaterialProgress(
  userId: string,
  materials: { category: string; content: string }[]
): Promise<MaterialProgress> {
  const categoryProgress: CategoryProgress = {
    self_intro: false,
    hobbies: false,
    hometown: false,
    travel_stories: false,
    fun_facts: false,
  };

  // 统计完成的分类
  let completedCount = 0;
  for (const material of materials) {
    const hasContent = material.content && material.content.trim().length > 0;
    const key = material.category as keyof CategoryProgress;
    if (key in categoryProgress) {
      categoryProgress[key] = hasContent;
      if (hasContent) completedCount++;
    }
  }

  // 计算完善度百分比
  const totalCategories = 5;
  const completionRate = Math.round((completedCount / totalCategories) * 100);

  // 计算质量评分（基于内容长度）
  let qualityScore = 0;
  for (const material of materials) {
    const length = material.content?.length || 0;
    if (length > 100) qualityScore += 1;
    if (length > 200) qualityScore += 0.5;
  }
  qualityScore = Math.min(5, Math.max(0, Math.round(qualityScore)));

  const progress = await prisma.materialProgress.upsert({
    where: { userId },
    update: {
      completionRate,
      qualityScore,
      categoryProgress: JSON.stringify(categoryProgress),
      lastEvaluatedAt: new Date(),
    },
    create: {
      userId,
      completionRate,
      qualityScore,
      categoryProgress: JSON.stringify(categoryProgress),
      totalMatches: 0,
    },
  });

  return {
    ...progress,
    categoryProgress: JSON.parse(progress.categoryProgress || '{}'),
  };
}

// 增加素材匹配使用次数
export async function incrementMaterialMatches(userId: string): Promise<void> {
  await prisma.materialProgress.updateMany({
    where: { userId },
    data: {
      totalMatches: { increment: 1 },
    },
  });
}

// 检查并解锁徽章
export async function checkAndUnlockBadges(userId: string): Promise<BadgeUnlockResult[]> {
  const results: BadgeUnlockResult[] = [];

  // 获取用户进度
  const progress = await getOrCreateMaterialProgress(userId);

  // 获取所有系统徽章
  const badges = await prisma.badge.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  // 获取用户已解锁的徽章
  const userBadges = await prisma.userBadge.findMany({
    where: { userId },
    select: { badgeId: true },
  });
  const unlockedBadgeIds = new Set(userBadges.map((ub) => ub.badgeId));

  // 检查每个徽章的解锁条件
  for (const badge of badges) {
    const isUnlocked = unlockedBadgeIds.has(badge.id);
    let shouldUnlock = false;

    switch (badge.key as BadgeType) {
      case 'story_novice':
        // 至少1个分类有内容
        shouldUnlock = progress.completionRate >= 20;
        break;
      case 'story_expert':
        // 所有5个分类都有内容
        shouldUnlock = progress.completionRate >= 100;
        break;
      case 'story_master':
        // 素材质量评分≥4星
        shouldUnlock = progress.qualityScore >= 4;
        break;
      case 'perfect_match':
        // 素材被成功匹配使用10次
        shouldUnlock = progress.totalMatches >= 10;
        break;
      case 'popular_material':
        // 检查是否有单条素材使用次数达到5次
        const popularMaterial = await prisma.userMaterial.findFirst({
          where: { userId, usageCount: { gte: 5 } },
        });
        shouldUnlock = !!popularMaterial;
        break;
    }

    if (shouldUnlock && !isUnlocked) {
      // 解锁徽章
      await prisma.userBadge.create({
        data: {
          userId,
          badgeId: badge.id,
          isNew: true,
        },
      });

      // 发放奖励
      if (badge.quotaReward > 0 || badge.daysReward > 0) {
        await grantRewards(userId, badge.quotaReward, badge.daysReward);
      }

      results.push({
        badge: badge as Badge,
        isNewUnlock: true,
        rewards: {
          quota: badge.quotaReward,
          days: badge.daysReward,
        },
      });
    }
  }

  return results;
}

// 发放奖励
async function grantRewards(
  userId: string,
  quotaReward: number,
  daysReward: number
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) return;

  // 发放额度奖励
  if (quotaReward > 0) {
    await prisma.quotaLog.create({
      data: {
        userId,
        type: 'badge_reward',
        amount: quotaReward,
        balance: (user.postcardCount || 0) + quotaReward,
        description: '徽章解锁奖励',
      },
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        postcardCount: { increment: quotaReward },
      },
    });
  }

  // 发放会员天数奖励
  if (daysReward > 0) {
    const now = new Date();
    const currentExpiry = user.planExpiresAt || now;
    const newExpiry = currentExpiry > now ? currentExpiry : now;
    newExpiry.setDate(newExpiry.getDate() + daysReward);

    await prisma.user.update({
      where: { id: userId },
      data: {
        plan: 'pro',
        planExpiresAt: newExpiry,
        rewardDays: { increment: daysReward },
      },
    });
  }
}

// 获取用户所有徽章
export async function getUserBadges(userId: string): Promise<UserBadge[]> {
  const userBadges = await prisma.userBadge.findMany({
    where: { userId },
    include: { badge: true },
    orderBy: { unlockedAt: 'desc' },
  });

  return userBadges.map((ub) => ({
    ...ub,
    badge: ub.badge as Badge,
  }));
}

// 标记徽章为已查看
export async function markBadgeAsViewed(userId: string, badgeId: string): Promise<void> {
  await prisma.userBadge.updateMany({
    where: { userId, badgeId },
    data: {
      isNew: false,
      viewedAt: new Date(),
    },
  });
}

// 获取用户未查看的新徽章数量
export async function getNewBadgeCount(userId: string): Promise<number> {
  return prisma.userBadge.count({
    where: { userId, isNew: true },
  });
}

// 获取下一个可解锁的徽章进度
export async function getNextAchievementProgress(userId: string) {
  const progress = await getOrCreateMaterialProgress(userId);

  const badges = await prisma.badge.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  const userBadges = await prisma.userBadge.findMany({
    where: { userId },
    select: { badgeId: true },
  });
  const unlockedBadgeIds = new Set(userBadges.map((ub) => ub.badgeId));

  const nextAchievements = [];

  for (const badge of badges) {
    if (unlockedBadgeIds.has(badge.id)) continue;

    let currentProgress = 0;
    let requiredProgress = 0;

    switch (badge.key as BadgeType) {
      case 'story_novice':
        currentProgress = Math.floor(progress.completionRate / 20);
        requiredProgress = 1;
        break;
      case 'story_expert':
        currentProgress = Math.floor(progress.completionRate / 20);
        requiredProgress = 5;
        break;
      case 'story_master':
        currentProgress = progress.qualityScore;
        requiredProgress = 4;
        break;
      case 'perfect_match':
        currentProgress = progress.totalMatches;
        requiredProgress = 10;
        break;
    }

    if (requiredProgress > 0) {
      nextAchievements.push({
        badge: badge as Badge,
        currentProgress,
        requiredProgress,
        percentage: Math.min(100, Math.round((currentProgress / requiredProgress) * 100)),
      });
    }
  }

  return nextAchievements;
}
