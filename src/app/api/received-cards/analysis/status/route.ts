import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLocalUserId } from '@/lib/local-user';

/**
 * GET /api/received-cards/analysis/status
 *
 * 收信 AI 分析状态统计（与 arrivals/analysis/status 对称）
 */
export async function GET(request: NextRequest) {
  try {
    const userId = getLocalUserId();

    // 获取所有有 OCR 文本的 gacha 记录
    const gachaLogs = await prisma.userGachaLog.findMany({
      where: { userId },
      select: {
        postcardId: true,
        aiScore: true,
        touchingScore: true,
        emotionalScore: true,
        culturalInsightScore: true,
        primaryCategory: true,
        summary: true,
      },
    });

    // 关联 received_cards 获取 ocrText 和 metadata
    const postcardIds = gachaLogs.map(g => g.postcardId).filter(Boolean) as string[];
    const cards = await prisma.receivedCard.findMany({
      where: { postcardId: { in: postcardIds } },
      select: { postcardId: true, ocrText: true, metadata: true },
    });
    const ocrMap = new Map(cards.map(c => [c.postcardId, c.ocrText]));
    const translationCount = cards.filter(c => {
      try {
        const meta = c.metadata ? JSON.parse(c.metadata) : {};
        return !!meta.translatedText;
      } catch { return false; }
    }).length;

    // 查询收信总数（作为进度分母）
    const totalCards = await prisma.receivedCard.count({ where: { userId } });

    // 统计
    const total = totalCards;
    const analyzed = gachaLogs.filter(g => g.aiScore && g.aiScore > 0).length;
    const pending = total - analyzed;
    const hasMessage = gachaLogs.filter(g => {
      const ocr = g.postcardId ? ocrMap.get(g.postcardId) : null;
      return ocr && ocr.trim().length >= 5;
    }).length;

    // 分数分布
    const scored = gachaLogs.filter(g => g.aiScore && g.aiScore > 0);
    const scoreDistribution = {
      excellent: scored.filter(g => g.aiScore! >= 240).length,
      good: scored.filter(g => g.aiScore! >= 180 && g.aiScore! < 240).length,
      fair: scored.filter(g => g.aiScore! >= 120 && g.aiScore! < 180).length,
      poor: scored.filter(g => g.aiScore! < 120).length,
    };

    const progress = total > 0
      ? ((analyzed / total) * 100).toFixed(1)
      : '0.0';

    return NextResponse.json({
      success: true,
      data: {
        total,
        analyzed,
        pending,
        hasMessage,
        noMessage: total - hasMessage,
        withTranslation: translationCount,
        scoreDistribution,
        progress,
      },
    });
  } catch (error) {
    console.error('获取收信分析状态失败:', error);
    return NextResponse.json(
      { error: '获取分析状态失败', success: false },
      { status: 500 },
    );
  }
}
