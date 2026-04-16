import { NextRequest, NextResponse } from 'next/server';
import { getLocalUserId } from '@/lib/local-user';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/arrivals/stats
 * 统计用户的 arrivals 数据（包括兜底分数量）
 */
export async function GET(request: NextRequest) {
  try {
    // 验证用户登录
    const userId = getLocalUserId();

    // 统计总数量
    const totalCount = await prisma.arrivalReply.count({
      where: { userId: userId },
    });

    // 查询所有 MessageAnalysis
    const allAnalyses = await prisma.messageAnalysis.findMany({
      where: { userId: userId },
      select: {
        aiScore: true,
        primaryCategory: true,
      },
    });

    // 统计兜底分（20 分）数量
    const fallbackCount = allAnalyses.filter(ma => ma.aiScore === 20).length;

    // 按分类统计
    const categoryStats = allAnalyses.reduce((acc, ma) => {
      if (!acc[ma.primaryCategory]) {
        acc[ma.primaryCategory] = {
          total: 0,
          fallback: 0,
        };
      }
      acc[ma.primaryCategory].total++;
      if (ma.aiScore === 20) {
        acc[ma.primaryCategory].fallback++;
      }
      return acc;
    }, {} as Record<string, { total: number; fallback: number }>);

    return NextResponse.json({
      success: true,
      data: {
        totalCount,
        analyzedCount: allAnalyses.length,
        fallbackCount,
        fallbackPercentage: allAnalyses.length > 0 
          ? ((fallbackCount / allAnalyses.length) * 100).toFixed(1) 
          : '0',
        categoryStats,
      },
    });
  } catch (error) {
    console.error('[/api/arrivals/stats] Error:', error);
    return NextResponse.json(
      { error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}
