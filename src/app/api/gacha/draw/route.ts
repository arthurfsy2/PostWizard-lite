import { NextRequest, NextResponse } from 'next/server';
import { gachaService } from '@/lib/services/gachaService';
import { getLocalUserId } from '@/lib/local-user';

// POST /api/gacha/draw - 执行抽卡（开源版：无需登录）
export async function POST(request: NextRequest) {
  try {
    const userId = getLocalUserId();

    // 解析请求参数
    const body = await request.json();
    const { postcardId, content, imageUrl } = body;

    // 验证必填参数
    if (!postcardId || !content) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数：postcardId 和 content' },
        { status: 400 }
      );
    }

    // 内容长度检查
    if (content.length < 5) {
      return NextResponse.json(
        { success: false, error: '明信片内容太短，至少需要 5 个字符' },
        { status: 400 }
      );
    }

    if (content.length > 2000) {
      return NextResponse.json(
        { success: false, error: '明信片内容太长，最多 2000 个字符' },
        { status: 400 }
      );
    }

    // 执行抽卡
    const result = await gachaService.draw(userId, postcardId, content);

    // 返回结果
    return NextResponse.json({
      success: true,
      data: {
        rarity: result.rarity,
        cardName: result.cardName,
        description: result.description,
        imageUrl: result.imageUrl,
        category: result.category,
        luckyLevel: result.luckyLevel,
        luckyBonus: result.luckyBonus,
        aiEvaluation: result.aiEvaluation || {
          touchingScore: 0,
          emotionalScore: 0,
          culturalInsightScore: 0,
          summary: '暂无评价',
          primaryCategory: 'emotional',
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '抽卡失败，请稍后重试',
      },
      { status: 500 }
    );
  }
}

// 获取稀有度配置信息（开源版：无需登录）
export async function GET(request: NextRequest) {
  try {
    const userId = getLocalUserId();

    // 获取用户抽卡历史
    let history = null;
    let stats = null;
    try {
      history = await gachaService.getUserGachaHistory(userId, 10);
      stats = await gachaService.getUserRarityStats(userId);
    } catch {
      // 首次使用时可能没有记录
    }

    return NextResponse.json({
      success: true,
      data: {
        pool: null,
        rarities: {
          SSR: { name: 'SSR', probability: '5%', color: '#FFD700', description: '世界著名地标' },
          SR: { name: 'SR', probability: '15%', color: '#C0C0C0', description: '著名景点' },
          R: { name: 'R', probability: '40%', color: '#CD7F32', description: '普通景点' },
          N: { name: 'N', probability: '40%', color: '#888888', description: '日常风景' },
        },
        userHistory: history ? history.map((log: any) => ({
          id: log.id,
          postcardId: log.postcardId,
          rarity: log.rarity,
          obtainedAt: log.obtainedAt,
        })) : null,
        userStats: stats,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: '获取配置失败' },
      { status: 500 }
    );
  }
}
