import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReferralService } from '../referralService';
import { prisma } from '../../prisma';

// Mock prisma
vi.mock('../../prisma', () => ({
  prisma: {
    referral: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    quotaLog: {
      create: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(prisma)),
  },
}));

describe('ReferralService', () => {
  let service: ReferralService;

  beforeEach(() => {
    service = new ReferralService();
    vi.clearAllMocks();
  });

  describe('getReferralInfo', () => {
    it('应该返回正确的邀请信息', async () => {
      const mockReferrals = [
        {
          id: 'ref1',
          referrerId: 'user1',
          referredId: 'user2',
          status: 'registered',
          paidAt: null,
          registerRewardGiven: true,
          paidRewardGiven: false,
          referred: { plan: 'free' },
        },
        {
          id: 'ref2',
          referrerId: 'user1',
          referredId: 'user3',
          status: 'paid',
          paidAt: new Date(),
          registerRewardGiven: true,
          paidRewardGiven: true,
          referred: { plan: 'monthly' },
        },
      ];

      vi.mocked(prisma.referral.findMany).mockResolvedValue(mockReferrals as any);

      const result = await service.getReferralInfo('user1', 'http://localhost:3000');

      expect(result.referralCode).toBe('user1'); // user1 的前8位就是 user1
      expect(result.referralLink).toBe('http://localhost:3000/invite?ref=user1');
      expect(result.stats.totalInvited).toBe(2);
      expect(result.stats.paidInvited).toBe(1);
      // 注册奖励: 2人*2次=4, 付费奖励: 1人*10次=10, 总计14
      expect(result.stats.totalRewards).toBe(14);
      expect(result.rewards.registerBonus).toBe(2);
      expect(result.rewards.paidBonus).toBe(10);
    });

    it('应该处理没有邀请记录的情况', async () => {
      vi.mocked(prisma.referral.findMany).mockResolvedValue([]);

      const result = await service.getReferralInfo('user1', 'http://localhost:3000');

      expect(result.stats.totalInvited).toBe(0);
      expect(result.stats.totalRewards).toBe(0);
    });
  });

  describe('validateReferralCode', () => {
    it('应该验证有效的邀请码', async () => {
      // 邀请码是用户ID的前8位，所以这里使用8位以上的字符串
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: 'user123456789',
      } as any);

      const result = await service.validateReferralCode('user1234');

      expect(result.valid).toBe(true);
      expect(result.referrer?.id).toBe('user123456789');
    });

    it('应该拒绝无效的邀请码', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

      const result = await service.validateReferralCode('invalid');

      expect(result.valid).toBe(false);
      expect(result.referrer).toBeUndefined();
    });

    it('应该拒绝过短的邀请码', async () => {
      const result = await service.validateReferralCode('abc');

      expect(result.valid).toBe(false);
    });
  });

  describe('processRegistration', () => {
    it('应该成功处理带邀请码的注册', async () => {
      const referrerId = 'referrer123';
      const referredId = 'referred456';

      vi.mocked(prisma.referral.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: referrerId } as any);
      vi.mocked(prisma.referral.count).mockResolvedValue(5);
      vi.mocked(prisma.referral.create).mockResolvedValue({ id: 'newRef' } as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);
      vi.mocked(prisma.quotaLog.create).mockResolvedValue({} as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ referralBonusQuota: 5 } as any);

      const result = await service.processRegistration(
        referredId,
        referrerId,
        '127.0.0.1',
        'fp123'
      );

      expect(result.success).toBe(true);
      expect(result.bonusGranted).toBe(3);
      expect(prisma.referral.create).toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalledTimes(3); // 更新被邀请人 referrerId + 两次奖励
    });

    it('应该处理无邀请码的注册', async () => {
      const referredId = 'referred456';

      vi.mocked(prisma.referral.findUnique).mockResolvedValue(null);

      const result = await service.processRegistration(referredId);

      expect(result.success).toBe(true);
      expect(result.bonusGranted).toBe(0);
      expect(result.message).toBe('无邀请码，正常注册');
    });

    it('应该拒绝已被邀请过的用户', async () => {
      const referredId = 'referred456';

      vi.mocked(prisma.referral.findUnique).mockResolvedValue({
        id: 'existingRef',
      } as any);

      const result = await service.processRegistration(referredId, 'someCode');

      expect(result.success).toBe(false);
      expect(result.message).toBe('用户已被邀请过');
    });

    it('应该拒绝自己邀请自己', async () => {
      // 邀请码是用户ID的前8位，模拟用户ID和邀请码匹配的情况
      const userId = 'user123456789';
      const referralCode = 'user1234'; // 用户ID的前8位

      vi.mocked(prisma.referral.findUnique).mockResolvedValue(null);
      // 验证邀请码时返回的用户ID就是当前用户
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: userId } as any);

      const result = await service.processRegistration(userId, referralCode);

      expect(result.success).toBe(false);
      expect(result.message).toBe('不能邀请自己');
    });

    it('应该拒绝邀请人达到上限的邀请码', async () => {
      const referrerId = 'referrer123';
      const referredId = 'referred456';

      vi.mocked(prisma.referral.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: referrerId } as any);
      vi.mocked(prisma.referral.count).mockResolvedValue(50); // 已达上限

      const result = await service.processRegistration(referredId, referrerId);

      expect(result.success).toBe(false);
      expect(result.message).toBe('邀请人已达到邀请上限');
    });
  });

  describe('processPayment', () => {
    it('应该成功发放付费奖励', async () => {
      const userId = 'user123';
      const referrerId = 'referrer456';

      vi.mocked(prisma.referral.findUnique).mockResolvedValue({
        id: 'ref1',
        referrerId,
        paidRewardGiven: false,
        referrer: { referralBonusQuota: 5 },
      } as any);

      vi.mocked(prisma.referral.update).mockResolvedValue({} as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);
      vi.mocked(prisma.quotaLog.create).mockResolvedValue({} as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ referralBonusQuota: 15 } as any);

      const result = await service.processPayment(userId);

      expect(result.success).toBe(true);
      expect(result.bonusGranted).toBe(10);
      expect(prisma.referral.update).toHaveBeenCalled();
    });

    it('应该处理无邀请关系的用户', async () => {
      const userId = 'user123';

      vi.mocked(prisma.referral.findUnique).mockResolvedValue(null);

      const result = await service.processPayment(userId);

      expect(result.success).toBe(true);
      expect(result.bonusGranted).toBe(0);
      expect(result.message).toBe('用户无邀请关系');
    });

    it('应该跳过已发放过奖励的用户', async () => {
      const userId = 'user123';

      vi.mocked(prisma.referral.findUnique).mockResolvedValue({
        id: 'ref1',
        referrerId: 'referrer456',
        paidRewardGiven: true,
      } as any);

      const result = await service.processPayment(userId);

      expect(result.success).toBe(true);
      expect(result.bonusGranted).toBe(0);
      expect(result.message).toBe('付费奖励已发放过');
    });
  });

  describe('getQuotaCheck', () => {
    it('应该返回正确的额度信息', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        freeUsedCount: 3,
        referralBonusQuota: 5,
      } as any);

      const result = await service.getQuotaCheck('user123', 5);

      expect(result.freeQuota).toBe(5);
      expect(result.freeUsed).toBe(3);
      expect(result.referralBonusQuota).toBe(5);
      expect(result.totalAvailable).toBe(7); // (5-3) + 5
    });

    it('应该处理已用完月度额度的情况', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        freeUsedCount: 5,
        referralBonusQuota: 3,
      } as any);

      const result = await service.getQuotaCheck('user123', 5);

      expect(result.totalAvailable).toBe(3); // 0 + 3
    });

    it('应该在用户不存在时抛出错误', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(service.getQuotaCheck('nonexistent', 5)).rejects.toThrow('用户不存在');
    });
  });

  describe('getReferralRules', () => {
    it('应该返回防刷规则配置', () => {
      const rules = service.getReferralRules();

      expect(rules.maxInvitesPerUser).toBe(50);
      expect(rules.maxRegistrationsPerIpPerDay).toBe(3);
      expect(rules.registerBonus).toBe(2);
      expect(rules.paidBonus).toBe(10);
    });
  });
});
