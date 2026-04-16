import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLocalUserId } from '@/lib/local-user';
import { processImage, updateCardImageStatus, getLocalImagePath } from '@/lib/services/imageProcessingService';

/**
 * POST /api/received-cards/[id]/adjust-image
 * 手动调整图片（旋转 + 矩形裁剪）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = getLocalUserId();
    const cardId = (await params).id;

    // 验证卡片属于当前用户
    const card = await prisma.receivedCard.findFirst({
      where: { id: cardId, userId },
    });

    if (!card) {
      return NextResponse.json(
        { error: '明信片不存在' },
        { status: 404 }
      );
    }

    // 解析请求参数
    const body = await request.json();
    const { rotation = 0, cropRect, enhance = true, quality = 85 } = body;

    // 更新状态为 processing
    await prisma.receivedCard.update({
      where: { id: cardId },
      data: { imageProcessingStatus: 'processing' },
    });

    // 获取原图路径
    const originalImagePath = getLocalImagePath(
      card.originalImageUrl || card.imageUrl
    );

    // 执行图片处理
    const result = await processImage(originalImagePath, cardId, userId, {
      rotation,
      cropRect,
      enhance,
      quality,
      maxWidth: 1800,
    });

    // 更新数据库
    await updateCardImageStatus(
      cardId,
      result.processedImageUrl,
      'completed',
      undefined,
      { rotation, cropRect, enhance, quality }
    );

    return NextResponse.json({
      id: cardId,
      processedImageUrl: result.processedImageUrl,
      status: 'completed',
      originalWidth: result.originalWidth,
      originalHeight: result.originalHeight,
      processedWidth: result.processedWidth,
      processedHeight: result.processedHeight,
      rotation,
      message: '图片调整完成',
    });
  } catch (error: any) {
    console.error('[AdjustImage] Error:', error);

    // 更新状态为 failed
    try {
      const cardId = (await params).id;
      await prisma.receivedCard.update({
        where: { id: cardId },
        data: {
          imageProcessingStatus: 'failed',
          imageProcessingError: error.message,
        },
      });
    } catch (updateError) {
      console.error('[AdjustImage] Failed to update status:', updateError);
    }

    return NextResponse.json(
      { error: '图片调整失败', details: error.message },
      { status: 500 }
    );
  }
}
