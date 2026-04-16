import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface VisitData {
  ip?: string;
  userAgent?: string;
  path: string;
  referer?: string;
  country?: string;
  city?: string;
  userId?: string;
  sessionId: string;
}

/**
 * 记录访问日志
 */
export async function logVisit(data: VisitData) {
  try {
    await prisma.visitLog.create({
      data: {
        ip: data.ip,
        userAgent: data.userAgent,
        path: data.path,
        referer: data.referer,
        country: data.country,
        city: data.city,
        userId: data.userId,
        sessionId: data.sessionId,
      },
    });
    
    // 同时更新用户的最后活跃时间
    if (data.userId) {
      await prisma.user.update({
        where: { id: data.userId },
        data: { lastActiveAt: new Date() },
      });
    }
  } catch (error) {
    // console.error('记录访问日志失败:', error);
  }
}

/**
 * 获取访问统计数据
 */
export async function getVisitStats(days: number = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // 总访问量
  const totalVisits = await prisma.visitLog.count({
    where: {
      createdAt: {
        gte: startDate,
      },
    },
  });

  // 独立访客数（按 sessionId）
  const uniqueVisitors = await prisma.visitLog.groupBy({
    by: ['sessionId'],
    where: {
      createdAt: {
        gte: startDate,
      },
    },
  });

  // 每日访问量
  const dailyVisits = await prisma.$queryRaw<
    { date: string; count: bigint }[]
  >`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as count
    FROM visit_logs 
    WHERE created_at >= ${startDate}
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `;

  // 热门页面
  const popularPages = await prisma.$queryRaw<
    { path: string; count: bigint }[]
  >`
    SELECT 
      path,
      COUNT(*) as count
    FROM visit_logs 
    WHERE created_at >= ${startDate}
    GROUP BY path
    ORDER BY count DESC
    LIMIT 10
  `;

  // 设备统计
  const deviceStats = await prisma.$queryRaw<
    { device_type: string; count: bigint }[]
  >`
    SELECT 
      CASE 
        WHEN user_agent LIKE '%Mobile%' THEN 'Mobile'
        WHEN user_agent LIKE '%Tablet%' THEN 'Tablet'
        ELSE 'Desktop'
      END as device_type,
      COUNT(*) as count
    FROM visit_logs 
    WHERE created_at >= ${startDate}
    GROUP BY device_type
    ORDER BY count DESC
  `;

  // 地理位置统计（前10）
  const geoStats = await prisma.$queryRaw<
    { country: string; city: string; count: bigint }[]
  >`
    SELECT 
      COALESCE(country, 'Unknown') as country,
      COALESCE(city, 'Unknown') as city,
      COUNT(*) as count
    FROM visit_logs 
    WHERE created_at >= ${startDate}
    GROUP BY country, city
    ORDER BY count DESC
    LIMIT 10
  `;

  return {
    totalVisits,
    uniqueVisitors: uniqueVisitors.length,
    dailyVisits: dailyVisits.map(v => ({
      date: v.date,
      count: Number(v.count),
    })),
    popularPages: popularPages.map(p => ({
      path: p.path,
      count: Number(p.count),
    })),
    deviceStats: deviceStats.map(d => ({
      device_type: d.device_type,
      count: Number(d.count),
    })),
    geoStats: geoStats.map(g => ({
      country: g.country,
      city: g.city,
      count: Number(g.count),
    })),
  };
}

/**
 * 获取实时在线用户数（最近5分钟有活动的）
 */
export async function getOnlineUsers() {
  const fiveMinutesAgo = new Date();
  fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

  const onlineSessions = await prisma.visitLog.groupBy({
    by: ['sessionId'],
    where: {
      createdAt: {
        gte: fiveMinutesAgo,
      },
    },
  });

  return onlineSessions.length;
}