import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLocalUserId } from '@/lib/local-user';
import { analyzeMessagesBatchOptimized, type SentimentAnalysisResult } from '@/lib/services/sentimentAnalysis';
import { getAIModel } from '@/lib/services/ai-config';
import { invalidateHighlightsCache } from '@/lib/services/cache';

/**
 * POST /api/arrivals/analysis/continue
 *
 * 继续未完成的 AI 分析（SSE 流式返回进度，每批完成立即入库）
 */
export async function POST(request: NextRequest) {
  const userId = getLocalUserId();

  // 获取当前用户的有效 arrivalReply
  const replies = await prisma.arrivalReply.findMany({
    where: {
      userId: userId,
      message: { not: null },
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

  // 获取当前用户已有分析的记录（排除 fallback 失败的，这些需要重新分析）
  const analyzed = await prisma.messageAnalysis.findMany({
    where: { userId },
    select: { postcardId: true, modelVersion: true },
  });
  const analyzedIds = new Set(analyzed.filter(r => r.modelVersion !== 'fallback-v1').map(r => r.postcardId));

  // 过滤出需要分析的（未分析 + fallback 失败的）
  const toAnalyze = replies.filter(r =>
    r.message &&
    r.message.trim().length >= 5 &&
    !analyzedIds.has(r.postcardId)
  );

  if (toAnalyze.length === 0) {
    return new Response(
      `data: ${JSON.stringify({ done: true, saved: 0 })}\n\n`,
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'X-Accel-Buffering': 'no',
        },
      }
    );
  }

  // 构建 postcardId → reply 映射，供回调快速查找
  const replyMap = new Map(toAnalyze.map(r => [r.postcardId, r]));

  const modelVersion = await getAIModel();
  const cacheTTL = 24 * 60 * 60 * 1000;
  const cacheValidUntil = new Date(Date.now() + cacheTTL);

  // SSE 流式响应
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {}
      };

      // 心跳：每 2 秒发一个空注释，防止 proxy 缓冲
      const keepalive = setInterval(() => {
        try { controller.enqueue(encoder.encode(': keepalive\n\n')); } catch {}
      }, 2000);

      // 通知前端开始
      send({ started: true, total: toAnalyze.length });

      let savedCount = 0;

      // 每批完成时立即入库保存
      const handleBatchComplete = async (batch: Array<{ id: string; message: string; analysis: SentimentAnalysisResult }>) => {
        for (const result of batch) {
          const pending = replyMap.get(result.id);
          if (!pending) {
            console.warn(`[批量保存] 跳过: result.id=${result.id} 未在 toAnalyze 中找到匹配`);
            continue;
          }

          const savedModelVersion = result.analysis._source === 'rule-engine'
            ? 'rule-engine-v1'
            : result.analysis._source === 'fallback'
              ? 'fallback-v1'
              : modelVersion;

          try {
            await prisma.messageAnalysis.upsert({
              where: { postcardId: result.id },
              create: {
                userId: pending.userId,
                postcardId: result.id,
                message: pending.message!,
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
                message: pending.message!,
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
            send({ saved: savedCount, total: toAnalyze.length });
            console.log(`[批量保存] ${savedCount}/${toAnalyze.length} - ${result.id} (${result.analysis._source})`);
          } catch (err) {
            console.error(`[批量保存] ${result.id} 失败:`, (err as Error).message);
          }
        }
      };

      try {
        console.log(`[批量分析] 开始分析 ${toAnalyze.length} 条留言...`);

        // 使用优化版批量分析，每批完成立即回调入库
        await analyzeMessagesBatchOptimized(
          toAnalyze.map(r => ({
            id: r.postcardId,
            message: r.message!,
          })),
          3,  // 每批 3 条（2048 token 限制下，5 条容易截断 JSON）
          (current, total) => {
            console.log(`[批量分析] 进度：${current}/${total}`);
            send({ analyzed: current, total });
          },
          3,  // 并行度
          handleBatchComplete  // 每批完成立即入库
        );

        // 清除精选缓存
        await invalidateHighlightsCache(userId);
        console.log(`[批量分析] 全部完成，成功保存 ${savedCount}/${toAnalyze.length} 条`);

        send({ done: true, saved: savedCount });
      } catch (error) {
        console.error('[批量分析] 错误:', error);
        send({ done: true, saved: savedCount, error: (error as Error).message });
      } finally {
        clearInterval(keepalive);
        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
