import { prisma } from '../prisma';

// ==================== 类型定义 ====================

export interface PaymentStats {
  totalRevenue: number;
  confirmedPayments: number;
  pendingPayments: number;
  averageOrderValue: number;
  byMonth: Array<{
    month: string;
    revenue: number;
    count: number;
  }>;
  byPlan: Array<{
    plan: string;
    count: number;
    revenue: number;
  }>;
}

export interface TokenStats {
  totalTokens: number;
  byDate: Array<{
    date: string;
    tokens: number;
    count: number;
  }>;
  byUser: Array<{
    userId: string;
    userEmail: string;
    tokens: number;
    count: number;
  }>;
}

export interface SubscriptionStats {
  distribution: Array<{
    plan: string;
    count: number;
    percentage: number;
  }>;
  revenueEstimate: {
    monthly: number;
    yearly: number;
    total: number;
  };
  conversionRate: {
    freeToPaid: number;
    trialToPaid: number;
  };
}

export interface UserActivityStats {
  totalUsers: number;
  activeUsers7d: number;
  activeUsers30d: number;
  newUsersTrend: Array<{
    date: string;
    count: number;
  }>;
}

export interface PostcardStats {
  totalPostcards: number;
  byStatus: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  generationTrend: Array<{
    date: string;
    count: number;
  }>;
}

// ==================== 缓存机制 ====================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class StatsCache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 分钟

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  clear(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
}

const statsCache = new StatsCache();

// ==================== StatsService 类 ====================

/**
 * 统计服务类
 * 提供 BI 面板所需的各类统计数据
 */
export class StatsService {
  // ==================== 收入统计 ====================

  /**
   * 获取收入统计（基于实际支付记录）
   * @param useCache 是否使用缓存（默认 true）
   */
  async getPaymentStats(useCache = true): Promise<PaymentStats> {
    const cacheKey = 'payment-stats';
    
    if (useCache) {
      const cached = statsCache.get<PaymentStats>(cacheKey);
      if (cached) return cached;
    }

    // 总营收和平均订单
    const confirmedPayments = await prisma.payment.findMany({
      where: { status: 'confirmed' },
      select: { amount: true, plan: true, createdAt: true },
    });

    const totalRevenue = confirmedPayments.reduce((sum, p) => sum + p.amount, 0);
    const averageOrderValue = confirmedPayments.length > 0 
      ? Math.round((totalRevenue / confirmedPayments.length) * 100) / 100 
      : 0;

    const pendingCount = await prisma.payment.count({
      where: { status: 'pending' },
    });

    // 按月统计（最近12个月）
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);

    const monthlyData = await prisma.payment.findMany({
      where: {
        status: 'confirmed',
        createdAt: {
          gte: twelveMonthsAgo,
        },
      },
      select: {
        amount: true,
        createdAt: true,
      },
    });

    // 按月份聚合
    const monthMap = new Map<string, { revenue: number; count: number }>();
    
    for (const item of monthlyData) {
      const month = item.createdAt.toISOString().slice(0, 7); // YYYY-MM
      const existing = monthMap.get(month) || { revenue: 0, count: 0 };
      existing.revenue += item.amount;
      existing.count += 1;
      monthMap.set(month, existing);
    }

    // 填充缺失月份（保证12个月数据）
    const byMonth: Array<{ month: string; revenue: number; count: number }> = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const month = date.toISOString().slice(0, 7);
      const data = monthMap.get(month) || { revenue: 0, count: 0 };
      byMonth.unshift({
        month: month,
        revenue: data.revenue,
        count: data.count,
      });
    }

    // 按套餐统计
    const planData = await prisma.payment.groupBy({
      by: ['plan'],
      where: { status: 'confirmed' },
      _count: true,
      _sum: { amount: true },
    });

    const byPlan = planData.map(item => ({
      plan: item.plan,
      count: item._count,
      revenue: item._sum.amount || 0,
    }));

    const result: PaymentStats = {
      totalRevenue,
      confirmedPayments: confirmedPayments.length,
      pendingPayments: pendingCount,
      averageOrderValue,
      byMonth,
      byPlan,
    };

    if (useCache) {
      statsCache.set(cacheKey, result);
    }

    return result;
  }

  // ==================== Token 消耗统计 ====================

  /**
   * 获取 Token 消耗统计
   * @param useCache 是否使用缓存（默认 true）
   */
  async getTokenStats(useCache = true): Promise<TokenStats> {
    const cacheKey = 'token-stats';
    
    if (useCache) {
      const cached = statsCache.get<TokenStats>(cacheKey);
      if (cached) return cached;
    }

    // 总 Token 消耗
    const totalResult = await prisma.sentCardContent.aggregate({
      _sum: {
        usedTokens: true,
      },
      _count: true,
    });

    const totalTokens = totalResult._sum.usedTokens || 0;

    // 按日期分组统计（最近 30 天）
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const byDateRaw = await prisma.sentCardContent.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: {
          gte: thirtyDaysAgo,
        },
        usedTokens: {
          not: null,
        },
      },
      _sum: {
        usedTokens: true,
      },
      _count: true,
    });

    // 按日期聚合（同一天的数据合并）
    const dateMap = new Map<string, { tokens: number; count: number }>();
    
    for (const item of byDateRaw) {
      const date = item.createdAt.toISOString().split('T')[0];
      const existing = dateMap.get(date) || { tokens: 0, count: 0 };
      existing.tokens += item._sum.usedTokens || 0;
      existing.count += item._count;
      dateMap.set(date, existing);
    }

    const byDate = Array.from(dateMap.entries())
      .map(([date, data]) => ({
        date,
        tokens: data.tokens,
        count: data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 按用户分组统计（Top 20）
    const byUserRaw = await prisma.sentCardContent.groupBy({
      by: ['emailId'],
      _sum: {
        usedTokens: true,
      },
      _count: true,
      where: {
        usedTokens: {
          not: null,
        },
      },
      orderBy: {
        _sum: {
          usedTokens: 'desc',
        },
      },
      take: 20,
    });

    // 获取用户信息
    const emailIds = byUserRaw.map(item => item.emailId).filter(Boolean) as string[];
    const emails = await prisma.email.findMany({
      where: { id: { in: emailIds } },
      include: {
        emailConfig: {
          include: {
            user: true,
          },
        },
      },
    });

    const emailMap = new Map(emails.map(e => [e.id, e]));
    const userEmailMap = new Map<string, string>();

    for (const email of emails) {
      if (email.emailConfig?.user) {
        userEmailMap.set(email.id, email.emailConfig.user.email);
      }
    }

    const byUser = byUserRaw.map(item => ({
      userId: item.emailId || 'unknown',
      userEmail: userEmailMap.get(item.emailId || '') || 'unknown',
      tokens: item._sum.usedTokens || 0,
      count: item._count,
    }));

    const result: TokenStats = {
      totalTokens,
      byDate,
      byUser,
    };

    if (useCache) {
      statsCache.set(cacheKey, result);
    }

    return result;
  }

  // ==================== 订阅统计 ====================

  /**
   * 获取订阅统计
   * @param useCache 是否使用缓存（默认 true）
   */
  async getSubscriptionStats(useCache = true): Promise<SubscriptionStats> {
    const cacheKey = 'subscription-stats';
    
    if (useCache) {
      const cached = statsCache.get<SubscriptionStats>(cacheKey);
      if (cached) return cached;
    }

    // 订阅分布
    const planCounts = await prisma.user.groupBy({
      by: ['plan'],
      _count: true,
    });

    const totalUsers = planCounts.reduce((sum, item) => sum + item._count, 0);

    const distribution = planCounts.map(item => ({
      plan: item.plan,
      count: item._count,
      percentage: totalUsers > 0 ? Math.round((item._count / totalUsers) * 100) : 0,
    }));

    // 收入估算（基于定价：月卡 ¥15.9、年卡 ¥99）
    const planPrices: Record<string, { monthly: number; yearly: number }> = {
      monthly: { monthly: 15.9, yearly: 15.9 * 12 },
      yearly: { monthly: 99 / 12, yearly: 99 },
    };

    let monthlyRevenue = 0;
    let yearlyRevenue = 0;

    for (const item of planCounts) {
      const price = planPrices[item.plan];
      if (price) {
        monthlyRevenue += price.monthly * item._count;
        yearlyRevenue += price.yearly * item._count;
      }
    }

    // 转化率计算
    const freeUsers = planCounts.find(item => item.plan === 'free')?._count || 0;
    const paidUsers = totalUsers - freeUsers;
    const freeToPaid = totalUsers > 0 ? Math.round((paidUsers / totalUsers) * 100) : 0;

    // 试用到付费转化（假设 trial 计划存在）
    const trialUsers = planCounts.find(item => item.plan === 'trial')?._count || 0;
    const trialToPaid = trialUsers > 0 
      ? Math.round(((paidUsers) / (trialUsers + paidUsers)) * 100) 
      : 0;

    const result: SubscriptionStats = {
      distribution,
      revenueEstimate: {
        monthly: Math.round(monthlyRevenue * 100) / 100,
        yearly: Math.round(yearlyRevenue * 100) / 100,
        total: Math.round(yearlyRevenue * 100) / 100,
      },
      conversionRate: {
        freeToPaid,
        trialToPaid,
      },
    };

    if (useCache) {
      statsCache.set(cacheKey, result);
    }

    return result;
  }

  // ==================== 用户活跃度统计 ====================

  /**
   * 获取用户活跃度统计
   * @param useCache 是否使用缓存（默认 true）
   */
  async getUserActivityStats(useCache = true): Promise<UserActivityStats> {
    const cacheKey = 'user-activity-stats';
    
    if (useCache) {
      const cached = statsCache.get<UserActivityStats>(cacheKey);
      if (cached) return cached;
    }

    // 总用户数
    const totalUsers = await prisma.user.count();

    // 活跃用户数（最近 7 天有生成内容）
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const activeUsers7d = await prisma.sentCardContent.findMany({
      where: {
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
      select: {
        email: {
          select: {
            emailConfig: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
      distinct: ['emailId'],
    });

    const uniqueUserIds7d = new Set(
      activeUsers7d
        .map(item => item.email?.emailConfig?.userId)
        .filter(Boolean)
    );

    // 活跃用户数（最近 30 天）
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeUsers30d = await prisma.sentCardContent.findMany({
      where: {
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
      select: {
        email: {
          select: {
            emailConfig: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
      distinct: ['emailId'],
    });

    const uniqueUserIds30d = new Set(
      activeUsers30d
        .map(item => item.email?.emailConfig?.userId)
        .filter(Boolean)
    );

    // 新增用户趋势（最近 30 天）
    const newUsersRaw = await prisma.user.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
      _count: true,
    });

    // 按日期聚合
    const dateMap = new Map<string, number>();
    
    for (const item of newUsersRaw) {
      const date = item.createdAt.toISOString().split('T')[0];
      const existing = dateMap.get(date) || 0;
      dateMap.set(date, existing + item._count);
    }

    const newUsersTrend = Array.from(dateMap.entries())
      .map(([date, count]) => ({
        date,
        count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const result: UserActivityStats = {
      totalUsers,
      activeUsers7d: uniqueUserIds7d.size,
      activeUsers30d: uniqueUserIds30d.size,
      newUsersTrend,
    };

    if (useCache) {
      statsCache.set(cacheKey, result);
    }

    return result;
  }

  // ==================== 明信片统计 ====================

  /**
   * 获取明信片统计
   * @param useCache 是否使用缓存（默认 true）
   */
  async getPostcardStats(useCache = true): Promise<PostcardStats> {
    const cacheKey = 'postcard-stats';
    
    if (useCache) {
      const cached = statsCache.get<PostcardStats>(cacheKey);
      if (cached) return cached;
    }

    // 总明信片数
    const totalPostcards = await prisma.postcard.count();

    // 按状态分组统计
    const statusCounts = await prisma.postcard.groupBy({
      by: ['status'],
      _count: true,
    });

    const byStatus = statusCounts.map(item => ({
      status: item.status,
      count: item._count,
      percentage: totalPostcards > 0 
        ? Math.round((item._count / totalPostcards) * 100) 
        : 0,
    }));

    // 生成趋势（最近 30 天）
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const generationRaw = await prisma.sentCardContent.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
      _count: true,
    });

    // 按日期聚合
    const dateMap = new Map<string, number>();
    
    for (const item of generationRaw) {
      const date = item.createdAt.toISOString().split('T')[0];
      const existing = dateMap.get(date) || 0;
      dateMap.set(date, existing + item._count);
    }

    const generationTrend = Array.from(dateMap.entries())
      .map(([date, count]) => ({
        date,
        count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const result: PostcardStats = {
      totalPostcards,
      byStatus,
      generationTrend,
    };

    if (useCache) {
      statsCache.set(cacheKey, result);
    }

    return result;
  }

  // ==================== 综合统计 ====================

  /**
   * 获取仪表盘综合统计（一次性获取所有数据）
   * @param useCache 是否使用缓存（默认 true）
   */
  async getDashboardStats(useCache = true) {
    const cacheKey = 'dashboard-stats';
    
    if (useCache) {
      const cached = statsCache.get<any>(cacheKey);
      if (cached) return cached;
    }

    const [tokenStats, subscriptionStats, userActivityStats, postcardStats] = 
      await Promise.all([
        this.getTokenStats(false),
        this.getSubscriptionStats(false),
        this.getUserActivityStats(false),
        this.getPostcardStats(false),
      ]);

    // 转换 subscriptionStats 为 dashboard 期望的格式
    const subscriptionData = {
      total: subscriptionStats.distribution.reduce((sum, item) => sum + item.count, 0),
      free: subscriptionStats.distribution.find(item => item.plan === 'free')?.count || 0,
      monthly: subscriptionStats.distribution.find(item => item.plan === 'monthly')?.count || 0,
      yearly: subscriptionStats.distribution.find(item => item.plan === 'yearly')?.count || 0,
    };

    const result = {
      token: tokenStats,
      subscription: subscriptionData,
      userActivity: userActivityStats,
      postcard: postcardStats,
      updatedAt: new Date().toISOString(),
    };

    if (useCache) {
      statsCache.set(cacheKey, result, 10 * 60 * 1000); // 10 分钟缓存
    }

    return result;
  }

  // ==================== 缓存管理 ====================

  /**
   * 清除指定统计的缓存
   */
  clearCache(key?: 'token-stats' | 'subscription-stats' | 'user-activity-stats' | 'postcard-stats' | 'dashboard-stats'): void {
    statsCache.clear(key);
  }

  /**
   * 清除所有缓存
   */
  clearAllCache(): void {
    statsCache.clear();
  }
}

// 导出服务实例
export const statsService = new StatsService();
