import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLocalUserId } from '@/lib/local-user';
import { analyzeMessage, analyzeMessagesBatch } from '@/lib/services/sentimentAnalysis';
import { getConfigForPurpose } from '@/lib/services/ai-config';
import { invalidateHighlightsCache } from '@/lib/services/cache';

/**
 * POST /api/arrivals/analyze
 * 
 * 分析单条或多条留言的情感
 * 
 * Request body:
 * - postcardId: string (单条分析时必填)
 * - message: string (单条分析时必填)
 * - force: boolean (可选，强制重新分析)
 * 
 * Response:
 * - 200: 分析成功
 * - 401: 未登录
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 认证
    const userId = getLocalUserId();

    // 2. 解析请求体
    const body = await request.json();
    const { postcardId, message, force = false } = body;

    // 3. 获取 AI 模型版本
    const modelVersion = (await getConfigForPurpose('text')).model;
    const cacheTTL = 24 * 60 * 60 * 1000; // 24 小时
    const cacheValidUntil = new Date(Date.now() + cacheTTL);

    // 4. 单条分析
    if (postcardId && message) {
      // 检查是否已有分析结果
      if (!force) {
        const existing = await prisma.messageAnalysis.findUnique({
          where: { postcardId },
        });

        if (existing && new Date(existing.cacheValidUntil) > new Date()) {
          return NextResponse.json({
            success: true,
            data: {
              id: existing.id,
              postcardId: existing.postcardId,
              message: existing.message,
              aiScore: existing.aiScore,
              categories: JSON.parse(existing.categories),
              primaryCategory: existing.primaryCategory,
              emotion: existing.emotion,
              tags: JSON.parse(existing.tags),
              analyzedAt: existing.analyzedAt,
              cached: true,
            },
          });
        }
      }

      // 5. 调用 AI 分析
      const analysis = await analyzeMessage(message);

      // 6. 保存分析结果
      const result = await prisma.messageAnalysis.upsert({
        where: { postcardId },
        create: {
          userId,
          postcardId,
          message,
          aiScore: analysis.score,
          categories: JSON.stringify(analysis.categories),
          primaryCategory: analysis.primaryCategory,
          emotion: analysis.emotion,
          tags: JSON.stringify(analysis.tags),
          cacheValidUntil,
          modelVersion,
        },
        update: {
          message,
          aiScore: analysis.score,
          categories: JSON.stringify(analysis.categories),
          primaryCategory: analysis.primaryCategory,
          emotion: analysis.emotion,
          tags: JSON.stringify(analysis.tags),
          cacheValidUntil,
          modelVersion,
          analyzedAt: new Date(),
        },
      });

      // 7. 清除缓存（因为有新分析结果）
      await invalidateHighlightsCache(userId);

      return NextResponse.json({
        success: true,
        data: {
          id: result.id,
          postcardId: result.postcardId,
          message: result.message,
          aiScore: result.aiScore,
          categories: JSON.parse(result.categories),
          primaryCategory: result.primaryCategory,
          emotion: result.emotion,
          tags: JSON.parse(result.tags),
          analyzedAt: result.analyzedAt,
          cached: false,
        },
      });
    }

    // 8. 批量分析（分析所有未分析的留言）
    // 获取需要分析的消息（message 不为空且没有分析结果的）
    const repliesToAnalyze = await prisma.arrivalReply.findMany({
      where: {
        userId,
        message: { not: null },
      },
      select: {
        id: true,
        postcardId: true,
        message: true,
        destinationCountry: true,
        arrivedAt: true,
      },
    });

    // 获取已分析的 postcardId 列表（排除 fallback 失败记录）
    const analyzedIds = await prisma.messageAnalysis.findMany({
      where: {
        userId,
        modelVersion: { not: 'fallback-v1' },
      },
      select: { postcardId: true },
    });
    const analyzedPostcardIds = new Set(analyzedIds.map(a => a.postcardId));

    // 过滤出未分析的
    const unanalyzed = repliesToAnalyze.filter(r => !analyzedPostcardIds.has(r.postcardId));

    if (unanalyzed.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          total: repliesToAnalyze.length,
          analyzed: analyzedPostcardIds.size,
          new: 0,
          message: '所有留言已分析完成',
        },
      });
    }

    // 9. 批量分析
    const analysisResults = await analyzeMessagesBatch(
      unanalyzed.map(r => ({
        id: r.postcardId,
        postcardId: r.postcardId,
        message: r.message!,
        destinationCountry: r.destinationCountry,
        arrivedAt: r.arrivedAt,
      })),
      (current, total) => {
        console.log(`📊 分析进度: ${current}/${total}`);
      }
    );

    // 10. 批量保存分析结果
    const createPromises = analysisResults.map(item =>
      prisma.messageAnalysis.upsert({
        where: { postcardId: item.postcardId },
        create: {
          userId,
          postcardId: item.postcardId,
          message: item.message,
          aiScore: item.analysis.score,
          categories: JSON.stringify(item.analysis.categories),
          primaryCategory: item.analysis.primaryCategory,
          emotion: item.analysis.emotion,
          tags: JSON.stringify(item.analysis.tags),
          cacheValidUntil,
          modelVersion,
        },
        update: {
          message: item.message,
          aiScore: item.analysis.score,
          categories: JSON.stringify(item.analysis.categories),
          primaryCategory: item.analysis.primaryCategory,
          emotion: item.analysis.emotion,
          tags: JSON.stringify(item.analysis.tags),
          cacheValidUntil,
          modelVersion,
          analyzedAt: new Date(),
        },
      })
    );

    await Promise.all(createPromises);

    // 11. 清除缓存
    await invalidateHighlightsCache(userId);

    return NextResponse.json({
      success: true,
      data: {
        total: repliesToAnalyze.length,
        analyzed: analyzedPostcardIds.size,
        new: analysisResults.length,
        message: `成功分析 ${analysisResults.length} 条新留言`,
      },
    });

  } catch (error) {
    console.error('[Arrivals Analyze POST] Error:', error);
    return NextResponse.json(
      { success: false, error: '分析失败', message: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/arrivals/analyze
 * 
 * 获取分析统计信息
 */
export async function GET(request: NextRequest) {
  try {
    const userId = getLocalUserId();

    // 统计
    const [totalReplies, analyzedCount, categoryStats] = await Promise.all([
      prisma.arrivalReply.count({
        where: { userId, message: { not: null } },
      }),
      prisma.messageAnalysis.count({ where: { userId } }),
      prisma.messageAnalysis.groupBy({
        by: ['primaryCategory'],
        where: { userId },
        _count: { primaryCategory: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        totalReplies,
        analyzedCount,
        pendingCount: totalReplies - analyzedCount,
        categories: categoryStats.map(c => ({
          category: c.primaryCategory,
          count: c._count.primaryCategory,
        })),
      },
    });

  } catch (error) {
    console.error('[Arrivals Analyze GET] Error:', error);
    return NextResponse.json(
      { success: false, error: '获取统计失败' },
      { status: 500 }
    );
  }
}
