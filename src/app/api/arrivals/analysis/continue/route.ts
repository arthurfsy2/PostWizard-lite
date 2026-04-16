import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLocalUserId } from '@/lib/local-user';
import { analyzeMessage } from '@/lib/services/sentimentAnalysis';
import { getAIModel } from '@/lib/services/ai-config';
import { invalidateHighlightsCache } from '@/lib/services/cache';
import { Semaphore } from '@/lib/utils/semaphore';

/**
 * POST /api/arrivals/analysis/continue
 * 
 * 继续未完成的 AI 分析（断点续传）
 */
export async function POST(request: NextRequest) {
  try {
    // 检查认证
    const userId = getLocalUserId();

    // 获取当前用户的有效 arrivalReply
    const replies = await prisma.arrivalReply.findMany({
      where: {
        userId: userId,
        message: {
          not: null,
        },
      },
      select: {
        id: true,
        postcardId: true,
        userId: true,
        message: true,
        recipientName: true,
        destinationCountry: true,
        arrivedAt: true,
      },
    });

    // 获取当前用户已有分析的记录
    const analyzed = await prisma.messageAnalysis.findMany({
      where: {
        userId: userId,
      },
      select: { postcardId: true }
    });
    const analyzedIds = new Set(analyzed.map(r => r.postcardId));

    // 过滤出需要分析的
    const toAnalyze = replies.filter(r => 
      r.message && 
      r.message.trim().length >= 5 &&
      !analyzedIds.has(r.postcardId)
    );

    if (toAnalyze.length === 0) {
      return NextResponse.json({
        success: true,
        message: '没有需要分析的记录',
        data: { analyzed: 0, pending: 0 },
      });
    }

    // 异步触发 AI 分析（不等待完成）
    const modelVersion = await getAIModel();
    const cacheTTL = 24 * 60 * 60 * 1000;
    const cacheValidUntil = new Date(Date.now() + cacheTTL);
    const aiSemaphore = new Semaphore(5);

    let successCount = 0;
    let failedCount = 0;

    // Fire-and-forget：不等待完成，直接返回
    void (async () => {
      try {
        for (const reply of toAnalyze) {
          try {
            await aiSemaphore.run(async () => {
              const analysis = await analyzeMessage(reply.message);

              await prisma.messageAnalysis.upsert({
                where: { postcardId: reply.postcardId },
                create: {
                  userId: reply.userId,
                  postcardId: reply.postcardId,
                  message: reply.message,
                  sender: reply.recipientName,
                  country: reply.destinationCountry,
                  arrivedAt: reply.arrivedAt,
                  aiScore: analysis.score,
                  categories: JSON.stringify(analysis.categories),
                  primaryCategory: analysis.primaryCategory,
                  emotion: analysis.emotion,
                  tags: JSON.stringify(analysis.tags),
                  translation: analysis.translation || null,
                  translationModel: analysis.translation ? modelVersion : null,
                  cacheValidUntil,
                  modelVersion,
                },
                update: {
                  message: reply.message,
                  sender: reply.recipientName,
                  country: reply.destinationCountry,
                  arrivedAt: reply.arrivedAt,
                  aiScore: analysis.score,
                  categories: JSON.stringify(analysis.categories),
                  primaryCategory: analysis.primaryCategory,
                  emotion: analysis.emotion,
                  tags: JSON.stringify(analysis.tags),
                  translation: analysis.translation || null,
                  translationModel: analysis.translation ? modelVersion : null,
                  cacheValidUntil,
                  modelVersion,
                  analyzedAt: new Date(),
                },
              });

              successCount++;
            });
          } catch (err) {
            failedCount++;
            console.error(`[AI 分析] ${reply.postcardId} 分析失败:`, err);
          }
        }

        // 完成后清除缓存
        if (successCount > 0) {
          await invalidateHighlightsCache(userId);
          console.log(`[AI 分析] 完成：成功 ${successCount} 条，失败 ${failedCount} 条`);
        }
      } catch (error) {
        console.error('[AI 分析] 批处理错误:', error);
      } finally {
        await prisma.$disconnect();
      }
    })();

    return NextResponse.json({
      success: true,
      message: `开始分析 ${toAnalyze.length} 条记录`,
      data: {
        total: toAnalyze.length,
        analyzed: 0,
        pending: toAnalyze.length,
      },
    });
  } catch (error) {
    console.error('触发 AI 分析失败:', error);
    return NextResponse.json(
      { error: '触发 AI 分析失败', success: false },
      { status: 500 }
    );
  }
}
