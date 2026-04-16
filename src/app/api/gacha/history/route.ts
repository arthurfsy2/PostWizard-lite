import { NextRequest, NextResponse } from 'next/server';
import { gachaService } from '@/lib/services/gachaService';
import { getLocalUserId } from '@/lib/local-user';

// GET /api/gacha/history - 获取用户抽卡历史（开源版：无需登录）
export async function GET(request: NextRequest) {
  try {
    const userId = getLocalUserId();

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // 获取抽卡历史
    const history = await gachaService.getUserGachaHistory(userId, limit);

    // 格式化返回数据
    const formattedHistory = history.map((log: any) => ({
      id: log.id,
      postcardId: log.postcardId,
      rarity: log.rarity,
      obtainedAt: log.obtainedAt,
    }));

    // 获取稀有度统计
    const stats = await gachaService.getUserRarityStats(userId);

    return NextResponse.json({
      success: true,
      data: {
        history: formattedHistory,
        stats,
        total: history.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: '获取抽卡历史失败' },
      { status: 500 }
    );
  }
}
