import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLocalUserId } from '@/lib/local-user';

/**
 * GET /api/received-cards/highlights
 *
 * 收信精选：按抽卡评分排序展示 TOP N
 * 数据源：ReceivedCard + CardEvaluation
 *
 * 分类逻辑（与 arrivals 统一）：
 * - lucky: luckyLevel !== null（扑克牌型）
 * - touching/culturalInsight/emotional: AI 分析时直接判定的 primaryCategory
 *
 * Query 参数：
 * - category: 'touching' | 'emotional' | 'culturalInsight' | 'lucky' (默认 'touching')
 * - limit: number (默认 20，最大 50)
 */
export async function GET(request: NextRequest) {
  try {
    const userId = getLocalUserId();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '20', 10));
    const category = searchParams.get('category') || 'touching';

    // 查询有抽卡记录的收信
    const gachaLogs = await prisma.cardEvaluation.findMany({
      where: {
        userId,
        postcardId: { not: null },
        aiScore: { not: null },
      },
      orderBy: { aiScore: 'desc' },
      select: {
        id: true,
        postcardId: true,
        rarity: true,
        aiScore: true,
        touchingScore: true,
        emotionalScore: true,
        culturalInsightScore: true,
        summary: true,
        primaryCategory: true,
        luckyLevel: true,
        luckyBonus: true,
        obtainedAt: true,
      },
    });

    // 查询收信总数（作为进度分母）
    const totalCards = await prisma.receivedCard.count({ where: { userId } });

    if (gachaLogs.length === 0) {
      return NextResponse.json({
        success: true,
        highlights: [],
        totalCount: 0,
        totalAnalyzed: 0,
        totalCards,
        category,
      });
    }

    // 过滤低分 + 按分类筛选
    const filtered = gachaLogs.filter(g => {
      if ((g.aiScore ?? 0) < 40) return false;
      if (category === 'lucky') {
        return g.luckyLevel && g.luckyLevel !== 'none';
      }
      // 兼容旧数据：primaryCategory 为空时 fallback 到 emotional
      const cat = g.primaryCategory || 'emotional';
      return cat === category;
    });

    // lucky 分类按 luckyBonus 降序，其他按 aiScore 降序
    if (category === 'lucky') {
      const luckyOrder: Record<string, number> = { superLucky: 3, special: 2, lucky: 1 };
      filtered.sort((a, b) => {
        const la = luckyOrder[a.luckyLevel || ''] || 0;
        const lb = luckyOrder[b.luckyLevel || ''] || 0;
        if (lb !== la) return lb - la;
        return (b.aiScore ?? 0) - (a.aiScore ?? 0);
      });
    }

    // 获取关联的收信记录
    const postcardIds = filtered.map(g => g.postcardId!).filter(Boolean);
    const cards = await prisma.receivedCard.findMany({
      where: { postcardId: { in: postcardIds } },
      select: {
        id: true,
        postcardId: true,
        country: true,
        city: true,
        ocrText: true,
        imageUrl: true,
        metadata: true,
        createdAt: true,
      },
    });

    const cardMap = new Map(cards.map(c => [c.postcardId, c]));

    // 去重：同一 sender 最多 2 条
    const seenSenders = new Map<string, number>();
    const deduplicated: typeof filtered = [];

    for (const log of filtered) {
      const card = cardMap.get(log.postcardId!);
      if (!card) continue;

      let metadata: any = {};
      try { metadata = card.metadata ? JSON.parse(card.metadata) : {}; } catch { metadata = {}; }

      const sender = metadata.senderUsername || card.country || 'unknown';
      const count = seenSenders.get(sender) || 0;
      if (count >= 2) continue;
      seenSenders.set(sender, count + 1);

      deduplicated.push(log);
    }

    // 取 TOP N
    const topLogs = deduplicated.slice(0, limit);

    // 构建响应
    const highlights = topLogs.map(log => {
      const card = cardMap.get(log.postcardId!);
      let metadata: any = {};
      try { metadata = card?.metadata ? JSON.parse(card.metadata) : {}; } catch { metadata = {}; }

      // 从 summary 中提取牌型描述（格式：...🃏 四条！Postcard ID 包含 4 个相同数字）
      const luckyReasonMatch = log.summary?.match(/🃏[^。]*$/);
      const luckyReason = luckyReasonMatch?.[0] || undefined;

      return {
        id: log.id,
        postcardId: log.postcardId,
        ocrText: card?.ocrText || '',
        translation: metadata.translatedText || undefined,
        country: card?.country || '',
        city: card?.city || '',
        senderUsername: metadata.senderUsername || '',
        imageUrl: card?.imageUrl || '',
        rarity: log.rarity,
        aiScore: log.aiScore ?? 0,
        touchingScore: log.touchingScore ?? 0,
        emotionalScore: log.emotionalScore ?? 0,
        culturalInsightScore: log.culturalInsightScore ?? 0,
        summary: log.summary || '',
        luckyLevel: log.luckyLevel,
        luckyBonus: log.luckyBonus,
        luckyReason,
        createdAt: card?.createdAt.toISOString() || log.obtainedAt.toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      highlights,
      totalCount: deduplicated.length,
      totalAnalyzed: gachaLogs.length,
      totalCards,
      category,
    });
  } catch (error) {
    console.error('[ReceivedCards Highlights] Error:', error);
    return NextResponse.json(
      { success: false, error: '获取收信精选失败', message: (error as Error).message },
      { status: 500 },
    );
  }
}
