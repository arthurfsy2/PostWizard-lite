import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLocalUserId } from '@/lib/local-user';
import { getAIModel } from '@/lib/services/ai-config';
import { getCachedHighlights, cacheHighlights } from '@/lib/services/cache';
import { normalizeCategory } from '@/lib/utils/categoryNormalize';

/**
 * GET /api/arrivals/highlights
 * 
 * 获取留言精选列表（Top 10 模式）
 * 
 * Query 参数：
 * - category: 'touching' | 'funny' | 'blessing' | 'cultural' (默认 'touching')
 * - limit: number (默认 10，最大 20)
 * - offset: number (默认 0，分页偏移)
 * - force: boolean (是否强制刷新缓存)
 * 
 * 筛选逻辑（2026-04-30 更新 - Top 20 模式）：
 * - 基础筛选：长度 >= 20 字符
 * - 最低分：aiScore >= 40（过滤模板话术等低质量内容）
 * - 去重：同用户最多 2 条/分类，同明信片不重复
 * - 排序：按 aiScore 降序，同分按到达日期降序
 * - 展示：每个分类固定展示 Top 20
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 认证
    const userId = getLocalUserId();

    // 2. 解析查询参数
    const { searchParams } = new URL(request.url);
    const rawCategory = searchParams.get('category') || 'touching';
    
    // 标准化分类 key（兼容旧值：funny → touching, blessing → emotional, cultural → culturalInsight）
    const category = normalizeCategory(rawCategory);
    
    if (!category) {
      // 无效分类 → 返回空数组，而非 404
      return NextResponse.json({
        success: true,
        highlights: [],
        totalAnalyzed: 0,
        totalCount: 0,
        hasMore: false,
        category: 'touching',
        cached: false,
        updatedAt: new Date().toISOString(),
        message: `无效的分类 "${rawCategory}"，已重定向到 "touching"`,
      });
    }
    
    const limit = Math.min(20, parseInt(searchParams.get('limit') || '10', 10));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));
    const force = searchParams.get('force') === '1';

    // 4. 获取模型版本用于缓存
    const modelVersion = await getAIModel();

    // 5. 尝试从缓存获取（非强制刷新）
    if (!force) {
      const cached = await getCachedHighlights<any>(userId, category, modelVersion);
      if (cached) {
        console.log('📦 [缓存命中] 留言精选，Category:', category);
        return NextResponse.json({
          success: true,
          ...cached,
          cached: true,
        });
      }
    }

    // 6. 从数据库获取分析结果（全量，用于去重后分页）
    // Top 10 模式：不再使用分类阈值，仅按分数排序
    // 兼容旧数据：DB 中可能存储的是新 key（emotional/culturalInsight）或旧 key（blessing/cultural）
    // 映射规则：新 key → 新 key，旧 key → 新 key（兜底兼容）
    const categoryToDbMap: Record<string, string> = {
      'touching': 'touching',
      'emotional': 'emotional',
      'culturalInsight': 'culturalInsight',
      // 兜底兼容：如果 DB 中有旧 key，映射到新 key
      'blessing': 'emotional',
      'cultural': 'culturalInsight',
    };
    const dbCategory = categoryToDbMap[category] || category;
    
    const analyses = await prisma.messageAnalysis.findMany({
      where: {
        userId,
        primaryCategory: dbCategory,
        message: {
          gte: '', // 确保不为空
        },
      },
      orderBy: [
        { aiScore: 'desc' },
        { arrivedAt: 'desc' },
        { id: 'asc' },
      ],
    });

    // 8. 第一阶段：完整过滤 + 去重（独立于分页，不受 offset 影响）
    const seenPostcardIds = new Set<string>();
    const seenSenders = new Map<string, number>(); // sender -> count

    const filteredResults: typeof analyses = [];
    for (const analysis of analyses) {
      const messageLength = (analysis.message || '').length;

      // 长度过滤 (>=20 字符) - 仅过滤质量过低内容
      // 移除上限：高质量长文（如个人故事、情感脆弱）不应被过滤
      if (messageLength < 20) {
        continue;
      }

      // 最低分过滤：过滤掉模板话术等低质量内容
      if (analysis.aiScore < 40) {
        continue;
      }

      // 去重：同一张明信片不重复
      if (seenPostcardIds.has(analysis.postcardId)) {
        continue;
      }
      seenPostcardIds.add(analysis.postcardId);

      // 去重：同一用户最多 2 条
      const sender = analysis.sender || 'unknown';
      const senderCount = seenSenders.get(sender) || 0;
      if (senderCount >= 2) {
        continue;
      }
      seenSenders.set(sender, senderCount + 1);

      filteredResults.push(analysis);
    }

    // 9. 第二阶段：纯分页（不再做去重过滤）
    const totalCount = filteredResults.length;
    const hasMore = totalCount > offset + limit;
    const pagedResults = filteredResults.slice(offset, offset + limit);

    // 10. 获取关联的 ArrivalReply 信息
    const postcardIds = pagedResults.map(r => r.postcardId);
    const replies = await prisma.arrivalReply.findMany({
      where: {
        postcardId: { in: postcardIds },
      },
      select: {
        postcardId: true,
        destinationCountry: true,
        arrivedAt: true,
        recipientName: true,
      },
    });
    
    const replyMap = new Map(replies.map(r => [r.postcardId, r]));

    // 11. 构建响应数据
    const highlights = pagedResults.map(analysis => {
      const reply = replyMap.get(analysis.postcardId);
      
      return {
        id: analysis.id,
        postcardId: analysis.postcardId,
        message: analysis.message,
        translation: analysis.translation || undefined,
        aiScore: analysis.aiScore,
        primaryCategory: analysis.primaryCategory,
        categories: JSON.parse(analysis.categories),
        emotion: analysis.emotion,
        tags: JSON.parse(analysis.tags),
        sender: analysis.sender,
        country: analysis.country || reply?.destinationCountry || '',
        arrivalDate: (analysis.arrivedAt || reply?.arrivedAt)?.toISOString() || null,
        analyzedAt: analysis.analyzedAt.toISOString(),
      };
    });

    // 12. 统计信息（与 /analysis/status 保持同口径：仅统计有效留言中已有分析的数量）
    const validReplies = await prisma.arrivalReply.findMany({
      where: {
        userId,
        message: {
          not: null,
        },
      },
      select: {
        postcardId: true,
        message: true,
      },
    });

    const validReplyIds = new Set(
      validReplies
        .filter(reply => reply.message && reply.message.trim().length >= 5)
        .map(reply => reply.postcardId)
    );

    const totalAnalyzed = await prisma.messageAnalysis.count({
      where: {
        userId,
        postcardId: {
          in: Array.from(validReplyIds),
        },
      },
    });

    // 13. 缓存结果（仅首页有缓存）
    const responseData = {
      highlights,
      totalAnalyzed,
      totalCount,
      hasMore,
      category,
      updatedAt: new Date().toISOString(),
    };

    if (offset === 0) {
      await cacheHighlights(userId, category, modelVersion, responseData);
    }

    return NextResponse.json({
      success: true,
      ...responseData,
      cached: false,
    });

  } catch (error) {
    console.error('[Highlights GET] Error:', error);
    return NextResponse.json(
      { success: false, error: '获取精选失败', message: (error as Error).message },
      { status: 500 }
    );
  }
}
