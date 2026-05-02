import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLocalUserId } from '@/lib/local-user';
import { getConfigForPurpose } from '@/lib/services/ai-config';
import { generateAIEvaluationBatch, type AIEvaluation } from '@/lib/services/gachaService';
import { translateMessage } from '@/lib/services/sentimentAnalysis';

/**
 * POST /api/received-cards/analysis/continue
 *
 * 批量重新分析收信明信片（SSE 流式返回进度）
 * - 评分：并发 3 批 × 每批 5 条
 * - 翻译：评分完成后自动补全非中文卡片的翻译
 */

function calculateRarity(totalScore: number): 'SSR' | 'SR' | 'R' | 'N' {
  if (totalScore >= 240) return 'SSR';
  if (totalScore >= 180) return 'SR';
  if (totalScore >= 120) return 'R';
  return 'N';
}

const BATCH_SIZE = 5;
const CONCURRENCY = 3;

export async function POST(request: NextRequest) {
  const userId = getLocalUserId();

  // 1. 查找已有但未评分的 gacha log
  const unscoredLogs = await prisma.userGachaLog.findMany({
    where: {
      userId,
      OR: [
        { aiScore: null },
        { aiScore: 0 },
      ],
    },
    select: {
      id: true,
      postcardId: true,
    },
  });

  // 2. 查找没有 gacha log 的收信（有 OCR 文本的）
  const allCards = await prisma.receivedCard.findMany({
    where: { userId },
    select: { postcardId: true, ocrText: true, metadata: true },
  });

  // 也排除已有评分的 gacha log 对应的 postcardId
  const allGachaPostcardIds = await prisma.userGachaLog.findMany({
    where: { userId, postcardId: { not: null } },
    select: { postcardId: true },
  });
  const analyzedIds = new Set(allGachaPostcardIds.map(g => g.postcardId).filter(Boolean));

  // 找出需要新建 gacha log 的卡片（有 OCR 文本、无 gacha log）
  const cardsNeedingLogs = allCards.filter(c =>
    c.postcardId &&
    !analyzedIds.has(c.postcardId) &&
    c.ocrText && c.ocrText.trim().length >= 5
  );

  // 批量创建缺失的 gacha log
  const newLogs: { id: string; postcardId: string }[] = [];
  for (const card of cardsNeedingLogs) {
    try {
      const log = await prisma.userGachaLog.create({
        data: {
          userId,
          postcardId: card.postcardId!,
          rarity: 'N',
          obtainedAt: new Date(),
        },
        select: { id: true, postcardId: true },
      });
      if (log.postcardId) newLogs.push(log as { id: string; postcardId: string });
    } catch (err) {
      // postcardId 唯一约束冲突说明已存在，跳过
      console.warn(`[收信继续分析] 创建 gacha log 跳过 ${card.postcardId}:`, (err as Error).message);
    }
  }

  // 3. 合并：未评分的（过滤掉 postcardId 为空的）+ 新建的
  const validUnscored = unscoredLogs.filter(g => g.postcardId) as { id: string; postcardId: string }[];
  const gachaLogs = [...validUnscored, ...newLogs];

  if (gachaLogs.length === 0) {
    return new Response(
      `data: ${JSON.stringify({ done: true, saved: 0, translated: 0 })}\n\n`,
      { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' } },
    );
  }

  const postcardIds = gachaLogs.map(g => g.postcardId).filter(Boolean) as string[];
  const cards = await prisma.receivedCard.findMany({
    where: { postcardId: { in: postcardIds } },
    select: { postcardId: true, ocrText: true, metadata: true },
  });
  const cardMap = new Map(cards.map(c => [c.postcardId, c]));

  const toAnalyze = gachaLogs
    .filter(g => {
      if (!g.postcardId) return false;
      const card = cardMap.get(g.postcardId);
      return card?.ocrText && card.ocrText.trim().length >= 5;
    })
    .map(g => ({
      id: g.id,
      postcardId: g.postcardId!,
      content: cardMap.get(g.postcardId!)!.ocrText!,
    }));

  if (toAnalyze.length === 0) {
    return new Response(
      `data: ${JSON.stringify({ done: true, saved: 0, translated: 0 })}\n\n`,
      { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' } },
    );
  }

  const modelVersion = (await getConfigForPurpose('text')).model;

  // 分批
  const batches: typeof toAnalyze[] = [];
  for (let i = 0; i < toAnalyze.length; i += BATCH_SIZE) {
    batches.push(toAnalyze.slice(i, i + BATCH_SIZE));
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch {}
      };

      const keepalive = setInterval(() => {
        try { controller.enqueue(encoder.encode(': keepalive\n\n')); } catch {}
      }, 2000);

      send({ started: true, total: toAnalyze.length, phase: 'scoring' });

      let savedCount = 0;
      let processedCount = 0;
      let translatedCount = 0;

      try {
        // ===== Phase 1: 并发批量评分 =====
        for (let i = 0; i < batches.length; i += CONCURRENCY) {
          const parallelBatches = batches.slice(i, i + CONCURRENCY);

          const batchResults = await Promise.all(
            parallelBatches.map(batch =>
              generateAIEvaluationBatch(
                batch.map(item => ({ id: item.postcardId, content: item.content })),
              ).then(results => ({ batch, results }))
            ),
          );

          for (const { batch, results } of batchResults) {
            const resultMap = new Map(results.map(r => [r.id, r.evaluation]));

            for (const item of batch) {
              const evaluation = resultMap.get(item.postcardId);
              if (!evaluation) {
                processedCount++;
                continue;
              }

              const totalScore = evaluation.touchingScore + evaluation.emotionalScore + evaluation.culturalInsightScore;
              const rarity = calculateRarity(totalScore);

              try {
                await prisma.userGachaLog.update({
                  where: { id: item.id },
                  data: {
                    aiScore: totalScore,
                    touchingScore: evaluation.touchingScore,
                    emotionalScore: evaluation.emotionalScore,
                    culturalInsightScore: evaluation.culturalInsightScore,
                    summary: evaluation.summary,
                    primaryCategory: evaluation.primaryCategory,
                    rarity,
                    model: modelVersion,
                  },
                });
                savedCount++;
              } catch (err) {
                console.error(`[收信重新分析] ${item.postcardId} 保存失败:`, (err as Error).message);
              }

              processedCount++;
              send({ analyzed: processedCount, total: toAnalyze.length, saved: savedCount, phase: 'scoring' });
            }
          }

          console.log(`[收信重新分析] 评分进度 ${savedCount}/${toAnalyze.length}`);

          // 并发轮次间延迟
          if (i + CONCURRENCY < batches.length) {
            await new Promise(r => setTimeout(r, 500));
          }
        }

        // ===== Phase 2: 补全翻译 =====
        send({ phase: 'translating', translated: 0, total: toAnalyze.length });

        // 找出需要翻译的卡片（非中文且无翻译）
        const needTranslation = toAnalyze.filter(item => {
          const card = cardMap.get(item.postcardId);
          if (!card) return false;
          const existingMeta = card.metadata ? JSON.parse(card.metadata) : {};
          if (existingMeta.translatedText) return false;
          // 纯中文不需要翻译
          const nonAscii = (item.content.match(/[^\x00-\x7F]/g) || []).length;
          return nonAscii / item.content.length <= 0.5;
        });

        for (let i = 0; i < needTranslation.length; i++) {
          const item = needTranslation[i];
          try {
            const translation = await translateMessage(item.content);
            if (translation) {
              const card = cardMap.get(item.postcardId);
              const existingMeta = card?.metadata ? JSON.parse(card.metadata) : {};
              await prisma.receivedCard.update({
                where: { postcardId: item.postcardId },
                data: {
                  metadata: JSON.stringify({
                    ...existingMeta,
                    translatedText: translation,
                  }),
                },
              });
              translatedCount++;
            }
          } catch (err) {
            console.error(`[收信翻译] ${item.postcardId} 失败:`, (err as Error).message);
          }

          send({ phase: 'translating', translated: i + 1, total: needTranslation.length, saved: savedCount });

          // 翻译间隔，避免限流
          if (i < needTranslation.length - 1) {
            await new Promise(r => setTimeout(r, 200));
          }
        }

        console.log(`[收信重新分析] 全部完成：评分 ${savedCount}/${toAnalyze.length}，翻译 ${translatedCount}/${needTranslation.length}`);
        send({ done: true, saved: savedCount, translated: translatedCount });
      } catch (error) {
        console.error('[收信重新分析] 错误:', error);
        send({ done: true, saved: savedCount, translated: translatedCount, error: (error as Error).message });
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
