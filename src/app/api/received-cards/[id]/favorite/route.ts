import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLocalUserId } from '@/lib/local-user';

/**
 * POST /api/received-cards/[id]/favorite
 * 切换收藏状态
 * 
 * Body: { isFavorite: boolean }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getLocalUserId();
    const { id: cardId } = await params;

    const body = await request.json();
    const { isFavorite } = body;

    // 验证记录存在
    const receivedCard = await prisma.receivedCard.findUnique({
      where: { id: cardId },
    });

    if (!receivedCard) {
      return NextResponse.json(
        { error: '收信记录不存在' },
        { status: 404 }
      );
    }

    // 验证所有权
    if (receivedCard.userId !== userId) {
      return NextResponse.json(
        { error: '无权操作此记录' },
        { status: 403 }
      );
    }

    // 更新收藏状态
    // 注意：需要先运行 prisma migration 添加 isFavorite 字段
    const updatedCard = await prisma.receivedCard.update({
      where: { id: cardId },
      data: { isFavorite },
    });
    
    return NextResponse.json({
      success: true,
      isFavorite: updatedCard.isFavorite,
    });
  } catch (error: any) {
    // console.error('Error updating favorite:', error);

    if (error.message === 'Unauthorized' || error.message === 'Session expired') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      { error: '更新收藏状态失败' },
      { status: 500 }
    );
  }
}
