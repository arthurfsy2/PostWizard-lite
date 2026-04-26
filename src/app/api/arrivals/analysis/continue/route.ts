import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLocalUserId } from '@/lib/local-user';
import { analyzeMessagesBatchOptimized } from '@/lib/services/sentimentAnalysis';
import { getAIModel } from '@/lib/services/ai-config';
import { invalidateHighlightsCache } from '@/lib/services/cache';

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

    // Fire-and-forget：不等待完成，直接返回
    void (async () => {
      try {
        console.log(`[批量分析] 开始分析 ${toAnalyze.length} 条留言...`);
        
        // 使用优化版批量分析（规则优先 + 批量 AI）
        const results = await analyzeMessagesBatchOptimized(
          toAnalyze.map(r => ({
            id: r.postcardId,
            message: r.message,
          })),
          20,  // 每批 20 条
          (current, total) => {
            console.log(`[批量分析] 进度：${current}/${total}`);
          }
        );
        
        console.log(`[批量分析] 分析完成，共 ${results.length} 条结果，开始保存到数据库...`);
        
        // 批量保存到数据库
        let savedCount = 0;
        for (const result of results) {
          const pending = toAnalyze.find(r => r.postcardId === result.id);
          if (!pending) continue;
          
          // 区分打分来源：规则引擎 vs AI
          const isRuleEngine = result.analysis._source === 'rule-engine';
          const savedModelVersion = isRuleEngine ? 'rule-engine-v1' : modelVersion;
          
          try {
            await prisma.messageAnalysis.upsert({
              where: { postcardId: result.id },
              create: {
                userId: pending.userId,
                postcardId: result.id,
                message: pending.message,
                sender: pending.recipientName,
                country: pending.destinationCountry,
                arrivedAt: pending.arrivedAt,
                aiScore: result.analysis.score,
                categories: JSON.stringify(result.analysis.categories),
                primaryCategory: result.analysis.primaryCategory,
                emotion: result.analysis.emotion,
                tags: JSON.stringify(result.analysis.tags),
                translation: result.analysis.translation || null,
                translationModel: result.analysis.translation ? savedModelVersion : null,
                cacheValidUntil,
                modelVersion: savedModelVersion,
              },
              update: {
                message: pending.message,
                sender: pending.recipientName,
                country: pending.destinationCountry,
                arrivedAt: pending.arrivedAt,
                aiScore: result.analysis.score,
                categories: JSON.stringify(result.analysis.categories),
                primaryCategory: result.analysis.primaryCategory,
                emotion: result.analysis.emotion,
                tags: JSON.stringify(result.analysis.tags),
                translation: result.analysis.translation || null,
                translationModel: result.analysis.translation ? savedModelVersion : null,
                cacheValidUntil,
                modelVersion: savedModelVersion,
                analyzedAt: new Date(),
              },
            });
            
            savedCount++;
            // 每保存 10 条输出一次日志
            if (savedCount % 10 === 0 || savedCount === results.length) {
              console.log(`[批量保存] 进度：${savedCount}/${results.length}`);
            }
          } catch (err) {
            console.error(`[批量分析] ${result.id} 保存失败:`, err);
          }
        }
        
        // 清除精选缓存
        await invalidateHighlightsCache(userId);
        console.log(`[批量分析] 完成：成功 ${savedCount}/${results.length} 条`);
      } catch (error) {
        console.error('[批量分析] 错误:', error);
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
