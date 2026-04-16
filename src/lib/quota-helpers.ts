import { prisma } from '@/lib/prisma';

/**
 * 检查并消耗用户额度
 * 额度规则：
 * - 免费用户：初始5次 + 奖励额度（反馈+邀请），永久有效，用完即止
 * - 付费用户：会员期内无限使用
 * @param userId 用户 ID
 * @returns { canUse: boolean, remaining: number, error?: string }
 */
export async function checkAndConsumeQuota(userId: string): Promise<{
  canUse: boolean;
  remaining: number;
  error?: string;
}> {
  // 获取用户信息
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return { canUse: false, remaining: 0, error: '用户不存在' };
  }

  // 检查是否为付费用户（月卡/年卡）
  const isPaidUser = user.plan !== 'free' && 
    user.planExpiresAt !== null && 
    user.planExpiresAt > new Date();

  if (isPaidUser) {
    // 付费用户会员期内无限额度
    return { canUse: true, remaining: Infinity };
  }

  // 免费用户：计算剩余额度（不会重置，永久有效）
  // 从 Settings 读取基础额度配置
  const settings = await prisma.settings.findUnique({
    where: { key: 'newUserFreeQuota' }
  });
  const BASE_QUOTA = settings ? parseInt(settings.value, 10) : 5;
  const totalQuota = BASE_QUOTA + (user.bonusQuota || 0) + (user.referralBonusQuota || 0);
  const used = user.freeUsedCount || 0;
  const remaining = Math.max(0, totalQuota - used);

  if (remaining <= 0) {
    return { 
      canUse: false, 
      remaining: 0, 
      error: '额度已用完，请升级付费会员获得无限额度' 
    };
  }

  // 消耗额度
  await prisma.user.update({
    where: { id: userId },
    data: {
      freeUsedCount: { increment: 1 },
    },
  });

  return { canUse: true, remaining: remaining - 1 };
}

/**
 * 仅检查额度（不消耗）
 * @param userId 用户 ID
 * @returns { canUse: boolean, remaining: number, isPaidUser: boolean }
 */
export async function checkQuotaOnly(userId: string): Promise<{
  canUse: boolean;
  remaining: number;
  isPaidUser: boolean;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return { canUse: false, remaining: 0, isPaidUser: false };
  }

  // 检查是否为付费用户（月卡/年卡）
  const isPaidUser = user.plan !== 'free' && 
    user.planExpiresAt !== null && 
    user.planExpiresAt > new Date();

  if (isPaidUser) {
    return { canUse: true, remaining: Infinity, isPaidUser: true };
  }

  // 免费用户：计算剩余额度（永久有效，不会重置）
  // 从 Settings 读取基础额度配置
  const settings = await prisma.settings.findUnique({
    where: { key: 'newUserFreeQuota' }
  });
  const BASE_QUOTA = settings ? parseInt(settings.value, 10) : 5;
  const totalQuota = BASE_QUOTA + (user.bonusQuota || 0) + (user.referralBonusQuota || 0);
  const used = user.freeUsedCount || 0;
  const remaining = Math.max(0, totalQuota - used);

  return { 
    canUse: remaining > 0, 
    remaining, 
    isPaidUser: false 
  };
}
