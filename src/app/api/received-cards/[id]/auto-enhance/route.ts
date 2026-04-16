import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLocalUserId } from '@/lib/local-user';
import { autoEnhanceImage, updateCardImageStatus, getLocalImagePath } from '@/lib/services/imageProcessingService';

/**
 * POST /api/received-cards/[id]/auto-enhance
 * 自动优化图片（上传后后台处理）
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

    // 如果已经有处理图，可以选择跳过或重新处理
    if (card.processedImageUrl && card.imageProcessingStatus === 'completed') {
      // 返回现有处理图
      return NextResponse.json({
        id: card.id,
        processedImageUrl: card.processedImageUrl,
        status: card.imageProcessingStatus,
        message: '图片已处理完成',
      });
    }

    // 更新状态为 processing
    await prisma.receivedCard.update({
      where: { id: cardId },
      data: { imageProcessingStatus: 'processing' },
    });

    // 获取原图路径
    const originalImagePath = getLocalImagePath(
      card.originalImageUrl || card.imageUrl
    );

    // 执行自动增强
    const result = await autoEnhanceImage(originalImagePath, cardId, userId);

    // 更新数据库
    await updateCardImageStatus(cardId, result.processedImageUrl, 'completed');

    return NextResponse.json({
      id: cardId,
      processedImageUrl: result.processedImageUrl,
      status: 'completed',
      originalWidth: result.originalWidth,
      originalHeight: result.originalHeight,
      processedWidth: result.processedWidth,
      processedHeight: result.processedHeight,
      message: '图片优化完成',
    });
  } catch (error: any) {
    console.error('[AutoEnhance] Error:', error);

    // 更新状态为 failed
    try {
      const cardId = (await request.params).id;
      await prisma.receivedCard.update({
        where: { id: cardId },
        data: {
          imageProcessingStatus: 'failed',
          imageProcessingError: error.message,
        },
      });
    } catch (updateError) {
      console.error('[AutoEnhance] Failed to update status:', updateError);
    }

    return NextResponse.json(
      { error: '图片处理失败', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/received-cards/[id]/auto-enhance
 * 获取图片处理状态
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = getLocalUserId();
    const cardId = (await params).id;

    const card = await prisma.receivedCard.findFirst({
      where: { id: cardId, userId },
      select: {
        id: true,
        imageUrl: true,
        originalImageUrl: true,
        processedImageUrl: true,
        imageProcessingStatus: true,
        imageProcessingError: true,
        imageAdjustedAt: true,
        imageProcessVersion: true,
      },
    });

    if (!card) {
      return NextResponse.json(
        { error: '明信片不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: card.id,
      imageUrl: card.processedImageUrl || card.imageUrl,
      originalImageUrl: card.originalImageUrl,
      processedImageUrl: card.processedImageUrl,
      status: card.imageProcessingStatus,
      error: card.imageProcessingError,
      adjustedAt: card.imageAdjustedAt,
      version: card.imageProcessVersion,
    });
  } catch (error: any) {
    console.error('[ImageStatus] Error:', error);
    return NextResponse.json(
      { error: '获取图片状态失败' },
      { status: 500 }
    );
  }
}
