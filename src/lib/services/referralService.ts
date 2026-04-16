import { prisma } from '../prisma';

// ==================== 类型定义 ====================

export interface ReferralInfo {
  referralCode: string;
  referralLink: string;
  stats: {
    totalInvited: number;
    paidInvited: number;
    totalRewards: number;
    pendingRewards: number;
  };
  rewards: {
    registerBonus: number;
    paidBonus: number;
  };
}

export interface ValidationResult {
  valid: boolean;
  referrer?: {
    id: string;
  };
}

export interface ReferralTrackData {
  referralCode: string;
  ip?: string;
  userAgent?: string;
  fingerprint?: string;
}

export interface QuotaCheckResult {
  freeQuota: number;
  freeUsed: number;
  referralBonusQuota: number;
  totalAvailable: number;
}

// 防刷规则常量
const REFERRAL_RULES = {
  maxInvitesPerUser: 50,
  maxRegistrationsPerIpPerDay: 3,
  rewardValidityDays: 7,
  registerBonus: 2,
  registerBonusForReferred: 3,
  paidBonus: 10,
};

// ==================== ReferralService 类 ====================

/**
 * 邀请系统服务类
 * 管理邀请关系、奖励发放、防刷检测
 */
export class ReferralService {
  /**
   * 获取用户的邀请信息
   * @param userId 用户ID
   * @param baseUrl 基础URL用于生成邀请链接
   */
  async getReferralInfo(userId: string, baseUrl: string): Promise<ReferralInfo> {
    // 获取用户的邀请记录
    const referrals = await prisma.referral.findMany({
      where: { referrerId: userId },
      include: {
        referred: {
          select: {
            plan: true,
          },
        },
      },
    });

    const totalInvited = referrals.length;
    const paidInvited = referrals.filter(r => r.status === 'paid' || r.paidAt).length;
    
    // 计算奖励
    const registerRewards = referrals.filter(r => r.registerRewardGiven).length * REFERRAL_RULES.registerBonus;
    const paidRewards = referrals.filter(r => r.paidRewardGiven).length * REFERRAL_RULES.paidBonus;
    const totalRewards = registerRewards + paidRewards;
    
    // 待发放奖励（已注册但未发注册奖励 + 已付费但未发付费奖励）
    const pendingRegisterRewards = referrals.filter(r => !r.registerRewardGiven).length * REFERRAL_RULES.registerBonus;
    const pendingPaidRewards = referrals.filter(r => r.paidAt && !r.paidRewardGiven).length * REFERRAL_RULES.paidBonus;
    const pendingRewards = pendingRegisterRewards + pendingPaidRewards;

    // 生成邀请码（使用用户ID前8位）
    const referralCode = userId.slice(0, 8);
    const referralLink = `${baseUrl}/invite?ref=${referralCode}`;

    return {
      referralCode,
      referralLink,
      stats: {
        totalInvited,
        paidInvited,
        totalRewards,
        pendingRewards,
      },
      rewards: {
        registerBonus: REFERRAL_RULES.registerBonus,
        paidBonus: REFERRAL_RULES.paidBonus,
      },
    };
  }

  /**
   * 验证邀请码是否有效
   * @param code 邀请码
   */
  async validateReferralCode(code: string): Promise<ValidationResult> {
    if (!code || code.length < 8) {
      return { valid: false };
    }

    // 查找邀请人（通过ID前缀匹配）
    const referrer = await prisma.user.findFirst({
      where: {
        id: {
          startsWith: code,
        },
      },
      select: {
        id: true,
      },
    });

    if (!referrer) {
      return { valid: false };
    }

    return {
      valid: true,
      referrer: {
        id: referrer.id,
      },
    };
  }

  /**
   * 追踪邀请来源（记录访问日志）
   * @param data 追踪数据
   */
  async trackReferral(data: ReferralTrackData): Promise<boolean> {
    try {
      // 验证邀请码是否有效
      const validation = await this.validateReferralCode(data.referralCode);
      if (!validation.valid) {
        return false;
      }

      // 这里可以记录访问日志到数据库或缓存
      // 用于分析邀请链接的点击情况
      // console.log('[Referral] Track:', {
      //   code: data.referralCode,
      //   ip: data.ip,
      //   userAgent: data.userAgent,
      //   fingerprint: data.fingerprint,
      //   timestamp: new Date().toISOString(),
      // });

      return true;
    } catch (error) {
      // console.error('[Referral] Track error:', error);
      return false;
    }
  }

  /**
   * 处理用户注册时的邀请关系
   * @param referredId 被邀请人ID
   * @param referralCode 邀请码
   * @param clientIp 客户端IP
   * @param fingerprint 设备指纹
   */
  async processRegistration(
    referredId: string,
    referralCode?: string,
    clientIp?: string,
    fingerprint?: string
  ): Promise<{
    success: boolean;
    bonusGranted: number;
    message: string;
  }> {
    // 检查用户是否已被邀请过
    const existingReferral = await prisma.referral.findUnique({
      where: { referredId },
    });

    if (existingReferral) {
      return {
        success: false,
        bonusGranted: 0,
        message: '用户已被邀请过',
      };
    }

    // 如果没有邀请码，直接返回
    if (!referralCode) {
      return {
        success: true,
        bonusGranted: 0,
        message: '无邀请码，正常注册',
      };
    }

    // 验证邀请码
    const validation = await this.validateReferralCode(referralCode);
    if (!validation.valid) {
      return {
        success: false,
        bonusGranted: 0,
        message: '无效的邀请码',
      };
    }

    const referrerId = validation.referrer!.id;

    // 不能邀请自己
    if (referrerId === referredId) {
      return {
        success: false,
        bonusGranted: 0,
        message: '不能邀请自己',
      };
    }

    // 检查邀请人是否已达到上限
    const referrerCount = await prisma.referral.count({
      where: { referrerId },
    });

    if (referrerCount >= REFERRAL_RULES.maxInvitesPerUser) {
      return {
        success: false,
        bonusGranted: 0,
        message: '邀请人已达到邀请上限',
      };
    }

    // 防刷检测：IP限制
    if (clientIp) {
      const ipCheck = await this.checkIpLimit(clientIp);
      if (!ipCheck.allowed) {
        return {
          success: false,
          bonusGranted: 0,
          message: ipCheck.message,
        };
      }
    }

    // 开始事务处理
    try {
      await prisma.$transaction(async (tx) => {
        // 1. 创建邀请记录
        await tx.referral.create({
          data: {
            referrerId,
            referredId,
            status: 'registered',
            registerRewardGiven: true,
          },
        });

        // 2. 更新被邀请人的 referrerId
        await tx.user.update({
          where: { id: referredId },
          data: { referrerId },
        });

        // 3. 给邀请人发放奖励
        await tx.user.update({
          where: { id: referrerId },
          data: {
            referralBonusQuota: {
              increment: REFERRAL_RULES.registerBonus,
            },
          },
        });

        // 4. 给被邀请人发放奖励
        await tx.user.update({
          where: { id: referredId },
          data: {
            referralBonusQuota: {
              increment: REFERRAL_RULES.registerBonusForReferred,
            },
          },
        });

        // 5. 记录额度变动日志 - 邀请人
        const referrerAfter = await tx.user.findUnique({
          where: { id: referrerId },
          select: { referralBonusQuota: true },
        });

        await tx.quotaLog.create({
          data: {
            userId: referrerId,
            type: 'referral_register',
            amount: REFERRAL_RULES.registerBonus,
            balance: referrerAfter?.referralBonusQuota || REFERRAL_RULES.registerBonus,
            description: `邀请好友注册奖励，好友ID: ${referredId.slice(0, 8)}`,
          },
        });

        // 6. 记录额度变动日志 - 被邀请人
        const referredAfter = await tx.user.findUnique({
          where: { id: referredId },
          select: { referralBonusQuota: true },
        });

        await tx.quotaLog.create({
          data: {
            userId: referredId,
            type: 'referral_register_bonus',
            amount: REFERRAL_RULES.registerBonusForReferred,
            balance: referredAfter?.referralBonusQuota || REFERRAL_RULES.registerBonusForReferred,
            description: '通过邀请链接注册获得额外额度',
          },
        });
      });

      return {
        success: true,
        bonusGranted: REFERRAL_RULES.registerBonusForReferred,
        message: '邀请关系建立成功，获得额外额度',
      };
    } catch (error) {
      // console.error('[Referral] Registration process error:', error);
      return {
        success: false,
        bonusGranted: 0,
        message: '处理邀请关系时发生错误',
      };
    }
  }

  /**
   * 处理付费成功时的邀请奖励
   * @param userId 付费用户ID
   */
  async processPayment(userId: string): Promise<{
    success: boolean;
    bonusGranted: number;
    message: string;
  }> {
    // 查找该用户的邀请记录
    const referral = await prisma.referral.findUnique({
      where: { referredId: userId },
    });

    if (!referral) {
      return {
        success: true,
        bonusGranted: 0,
        message: '用户无邀请关系',
      };
    }

    // 检查是否已发放过付费奖励
    if (referral.paidRewardGiven) {
      return {
        success: true,
        bonusGranted: 0,
        message: '付费奖励已发放过',
      };
    }

    const referrerId = referral.referrerId;

    try {
      await prisma.$transaction(async (tx) => {
        // 1. 更新邀请记录
        await tx.referral.update({
          where: { id: referral.id },
          data: {
            status: 'paid',
            paidAt: new Date(),
            paidRewardGiven: true,
          },
        });

        // 2. 给邀请人发放付费奖励
        await tx.user.update({
          where: { id: referrerId },
          data: {
            referralBonusQuota: {
              increment: REFERRAL_RULES.paidBonus,
            },
          },
        });

        // 3. 记录额度变动日志
        const referrerAfter = await tx.user.findUnique({
          where: { id: referrerId },
          select: { referralBonusQuota: true },
        });

        await tx.quotaLog.create({
          data: {
            userId: referrerId,
            type: 'referral_paid',
            amount: REFERRAL_RULES.paidBonus,
            balance: referrerAfter?.referralBonusQuota || REFERRAL_RULES.paidBonus,
            description: `邀请好友首次付费奖励，好友ID: ${userId.slice(0, 8)}`,
          },
        });
      });

      return {
        success: true,
        bonusGranted: REFERRAL_RULES.paidBonus,
        message: '付费奖励发放成功',
      };
    } catch (error) {
      // console.error('[Referral] Payment reward error:', error);
      return {
        success: false,
        bonusGranted: 0,
        message: '发放付费奖励时发生错误',
      };
    }
  }

  /**
   * 获取用户额度信息
   * @param userId 用户ID
   * @param freeLimit 月度免费额度（可选，默认从Settings读取）
   */
  async getQuotaCheck(userId: string, freeLimit?: number): Promise<QuotaCheckResult> {
    // 如果未提供 freeLimit，从 Settings 读取
    let baseQuota = freeLimit;
    if (baseQuota === undefined) {
      const setting = await prisma.settings.findUnique({
        where: { key: 'newUserFreeQuota' }
      });
      baseQuota = setting ? parseInt(setting.value, 10) : 5;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        freeUsedCount: true,
        referralBonusQuota: true,
      },
    });

    if (!user) {
      throw new Error('用户不存在');
    }

    const freeQuota = baseQuota;
    const freeUsed = user.freeUsedCount;
    const referralBonusQuota = user.referralBonusQuota;
    
    // 总可用额度 = 月度额度 - 已使用 + 邀请奖励额度
    const monthlyRemaining = Math.max(0, freeQuota - freeUsed);
    const totalAvailable = monthlyRemaining + referralBonusQuota;

    return {
      freeQuota,
      freeUsed,
      referralBonusQuota,
      totalAvailable,
    };
  }

  /**
   * 检查IP限制
   * @param ip 客户端IP
   */
  private async checkIpLimit(ip: string): Promise<{
    allowed: boolean;
    message: string;
  }> {
    // 获取24小时内的注册数量
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    // 通过 QuotaLog 分析注册记录（基于 type 和时间）
    const recentRegistrations = await prisma.quotaLog.count({
      where: {
        type: 'referral_register_bonus',
        createdAt: {
          gte: oneDayAgo,
        },
      },
    });

    if (recentRegistrations >= REFERRAL_RULES.maxRegistrationsPerIpPerDay) {
      return {
        allowed: false,
        message: '同一IP注册过于频繁，请稍后再试',
      };
    }

    return {
      allowed: true,
      message: '通过IP检查',
    };
  }

  /**
   * 获取防刷规则配置
   */
  getReferralRules() {
    return { ...REFERRAL_RULES };
  }

  /**
   * 获取用户的额度日志
   * @param userId 用户ID
   * @param limit 限制条数
   */
  async getQuotaLogs(userId: string, limit: number = 50) {
    return prisma.quotaLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}

// 导出服务实例
export const referralService = new ReferralService();
