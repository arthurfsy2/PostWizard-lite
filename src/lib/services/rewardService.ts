/**
 * 奖励服务模块
 * 统一处理用户反馈奖励的计算和发放
 * 支持邮件反馈和前端反馈两种来源
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ==================== 类型定义 ====================

export type RewardType = 'quota' | 'days';

export interface RewardConfig {
  type: RewardType;
  min: number;
  max: number;
}

export interface RewardConfigMap {
  FREE: RewardConfig;
  PREMIUM: RewardConfig;
}

export interface AIAnalysisResult {
  category: string;
  priority: string;
  sentiment: string;
}

export interface RewardCalculationInput {
  isPremium: boolean;
  aiAnalysis: AIAnalysisResult;
  contentLength: number;
}

export interface RewardCalculationResult {
  type: RewardType;
  amount: number;
}

export interface GrantRewardInput {
  userId: string;
  feedbackId: string;
  rewardType: RewardType;
  amount: number;
  userCurrentExpiry?: Date | null;
  userCurrentBonusQuota?: number;
}

export interface GrantRewardResult {
  success: boolean;
  type: RewardType;
  amount: number;
  newTotal?: number;
  newExpiryDate?: Date;
  error?: string;
}

// ==================== 奖励配置 ====================

/**
 * 奖励配置（AI 动态评估，有上下限）
 */
export const REWARD_CONFIG: RewardConfigMap = {
  FREE: {
    type: 'quota' as const,
    min: 1, // 最少 1 额度
    max: 5, // 最多 5 额度
  },
  PREMIUM: {
    type: 'days' as const,
    min: 1, // 最少 1 天
    max: 3, // 最多 3 天
  },
};

// ==================== 奖励计算 ====================

/**
 * 根据 AI 评估结果计算奖励数量
 * @param input - 奖励计算输入参数
 * @returns 奖励类型和数量
 */
export function calculateReward(input: RewardCalculationInput): RewardCalculationResult {
  const { isPremium, aiAnalysis, contentLength } = input;
  const config = isPremium ? REWARD_CONFIG.PREMIUM : REWARD_CONFIG.FREE;

  // 基础分（根据分类）
  let score = 0;
  switch (aiAnalysis.category) {
    case 'bug':
      score = 3; // Bug 报告较重要
      break;
    case 'suggestion':
      score = 2; // 建议有价值
      break;
    case 'complaint':
      score = 2; // 投诉需重视
      break;
    default: // inquiry
      score = 1;
  }

  // 优先级加分
  switch (aiAnalysis.priority) {
    case 'P0':
      score += 2;
      break;
    case 'P1':
      score += 1;
      break;
    // P2 不加分
  }

  // 情感加分（鼓励正面反馈）
  if (aiAnalysis.sentiment === 'positive') {
    score += 1;
  }

  // 内容长度加分（鼓励详细反馈）
  if (contentLength > 200) {
    score += 1;
  }
  if (contentLength > 500) {
    score += 1;
  }

  // 在范围内限制
  const amount = Math.max(config.min, Math.min(config.max, score));

  return {
    type: config.type,
    amount,
  };
}

// ==================== 奖励发放 ====================

/**
 * 发放奖励给用户
 * 使用事务确保幂等性（通过 feedback.rewardGrantedAt 检查）
 * @param input - 奖励发放输入参数
 * @returns 发放结果
 */
export async function grantReward(input: GrantRewardInput): Promise<GrantRewardResult> {
  const { userId, feedbackId, rewardType, amount, userCurrentExpiry, userCurrentBonusQuota } = input;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. 检查是否已发放（幂等性检查）
      const feedback = await tx.feedback.findUnique({
        where: { id: feedbackId },
        select: { rewardGrantedAt: true },
      });

      if (!feedback) {
        throw new Error('Feedback not found');
      }

      if (feedback.rewardGrantedAt) {
        // 已发放过，返回成功但不重复发放
        return {
          alreadyGranted: true,
          type: rewardType,
          amount,
        };
      }

      // 2. 发放奖励
      let rewardResult: {
        type: RewardType;
        amount: number;
        newTotal?: number;
        newExpiryDate?: Date;
      };

      if (rewardType === 'days') {
        // 付费用户：延长会员有效期
        const currentExpiry = userCurrentExpiry || new Date();
        const newExpiryDate = new Date(currentExpiry);
        newExpiryDate.setDate(newExpiryDate.getDate() + amount);

        await tx.user.update({
          where: { id: userId },
          data: { planExpiresAt: newExpiryDate },
        });

        rewardResult = {
          type: 'days',
          amount,
          newExpiryDate,
        };
      } else {
        // 免费用户：增加额度
        const currentQuota = userCurrentBonusQuota || 0;
        const newBonusQuota = currentQuota + amount;

        await tx.user.update({
          where: { id: userId },
          data: { bonusQuota: newBonusQuota },
        });

        rewardResult = {
          type: 'quota',
          amount,
          newTotal: newBonusQuota,
        };
      }

      // 3. 更新 Feedback 记录，标记奖励已发放
      await tx.feedback.update({
        where: { id: feedbackId },
        data: {
          rewardType,
          rewardAmount: amount,
          rewardGrantedAt: new Date(),
        },
      });

      return {
        alreadyGranted: false,
        ...rewardResult,
      };
    });

    return {
      success: true,
      type: result.type,
      amount: result.amount,
      newTotal: result.newTotal,
      newExpiryDate: result.newExpiryDate,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      type: rewardType,
      amount,
      error: errorMessage,
    };
  }
}

/**
 * 检查用户是否为付费用户
 * @param userPlan - 用户套餐类型
 * @param planExpiresAt - 套餐过期时间
 * @returns 是否为付费用户
 */
export function isPremiumUser(userPlan: string, planExpiresAt: Date | null | undefined): boolean {
  return userPlan !== 'FREE' && !!planExpiresAt && planExpiresAt > new Date();
}

/**
 * 获取奖励配置
 * @param isPremium - 是否为付费用户
 * @returns 对应的奖励配置
 */
export function getRewardConfig(isPremium: boolean): RewardConfig {
  return isPremium ? REWARD_CONFIG.PREMIUM : REWARD_CONFIG.FREE;
}
