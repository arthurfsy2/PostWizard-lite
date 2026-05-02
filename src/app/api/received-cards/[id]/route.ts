import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLocalUserId } from '@/lib/local-user';
import { checkDuplicateReceivedCard } from '@/lib/helpers/duplicateChecker';

/**
 * GET /api/received-cards/[id]
 * 获取单条收信记录详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getLocalUserId();
    const { id: cardId } = await params;

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
        { error: '无权查看此记录' },
        { status: 403 }
      );
    }

    // 解析 metadata
    let metadata: any = {};
    try {
      metadata = receivedCard.metadata ? JSON.parse(receivedCard.metadata) : {};
    } catch (e) {
      metadata = {};
    }

    // 查询关联的抽卡记录获取稀有度信息
    const gachaLog = receivedCard.postcardId
      ? await prisma.cardEvaluation.findUnique({
          where: { postcardId: receivedCard.postcardId },
          select: {
            rarity: true,
            luckyLevel: true,
          },
        })
      : null;

    // 直接返回 URL（相对路径或完整 URL）
    const backImageUrl = receivedCard.imageUrl || null;
    const frontImageUrl = metadata.frontImageUrl || null;
    const processedImageUrl = receivedCard.processedImageUrl || null;
    const originalImageUrl = receivedCard.originalImageUrl || null;

    // 转换字段名以兼容前端
    return NextResponse.json({
      id: receivedCard.id,
      postcardId: receivedCard.postcardId,
      postcardIdConfirmed: receivedCard.postcardIdConfirmed,
      senderUsername: metadata.senderUsername || null,
      senderCountry: receivedCard.country,
      senderCity: receivedCard.city,
      handwrittenText: receivedCard.ocrText,
      translatedText: metadata.translatedText || null,
      detectedLang: metadata.detectedLang || null,
      ocrConfidence: metadata.ocrConfidence || null,
      backImageUrl,
      frontImageUrl,
      processedImageUrl,
      originalImageUrl,
      imageProcessingStatus: receivedCard.imageProcessingStatus,
      isFavorite: receivedCard.isFavorite,
      isOcrManualEdit: metadata.isOcrManualEdit || false,
      createdAt: receivedCard.createdAt,
      // 抽卡关联信息
      rarity: gachaLog?.rarity || null,
      luckyLevel: gachaLog?.luckyLevel || null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: '获取收信记录失败' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/received-cards/[id]
 * 更新收信记录（编辑 OCR 结果）
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getLocalUserId();
    const { id: cardId } = await params;

    const body = await request.json();

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

    // 检查 Postcard ID 是否已被其他记录使用（重复检测）- 收信专用函数
    if (body.postcardId && !body.allowOverwrite) {
      // 排除当前记录本身（编辑场景下允许保存自己的 postcardId）
      const duplicate = await prisma.receivedCard.findFirst({
        where: {
          postcardId: body.postcardId,
          userId,
          id: { not: cardId }, // 排除当前记录
        },
      });
      
      if (duplicate) {
        // 发现重复，返回提示让前端确认是否覆盖
        return NextResponse.json({
          error: 'DUPLICATE_POSTCARD_ID',
          message: `该明信片 ID (${body.postcardId}) 已存在于历史记录中`,
          duplicateCardId: duplicate.id,
          duplicateInfo: {
            postcardId: duplicate.postcardId,
            createdAt: duplicate.createdAt,
            formattedTime: duplicate.createdAt.toLocaleString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            }),
            country: duplicate.country,
            city: duplicate.city,
          },
          action: 'overwrite', // 告知前端用户可以选择覆盖
        }, { status: 409 }); // 409 Conflict
      }
    }

    // 解析现有 metadata
    let existingMetadata: any = {};
    try {
      existingMetadata = receivedCard.metadata ? JSON.parse(receivedCard.metadata) : {};
    } catch (e) {
      existingMetadata = {};
    }

    // 转换前端字段名为数据库字段名
    const updateData: any = {};

    // 直接映射的字段
    if (body.postcardId !== undefined) updateData.postcardId = body.postcardId;
    if (body.postcardIdConfirmed !== undefined) updateData.postcardIdConfirmed = body.postcardIdConfirmed;
    if (body.isFavorite !== undefined) updateData.isFavorite = body.isFavorite;

    // 需要转换的字段
    if (body.senderCountry !== undefined) updateData.country = body.senderCountry;
    if (body.senderCity !== undefined) updateData.city = body.senderCity;
    if (body.handwrittenText !== undefined) updateData.ocrText = body.handwrittenText;

    // 需要存入 metadata 的字段
    const newMetadata = { ...existingMetadata };
    if (body.senderUsername !== undefined) newMetadata.senderUsername = body.senderUsername;
    if (body.translatedText !== undefined) newMetadata.translatedText = body.translatedText;
    if (body.detectedLang !== undefined) newMetadata.detectedLang = body.detectedLang;
    if (body.ocrConfidence !== undefined) newMetadata.ocrConfidence = body.ocrConfidence;
    if (body.frontImageUrl !== undefined) newMetadata.frontImageUrl = body.frontImageUrl;
    // 标记为手动编辑
    newMetadata.isOcrManualEdit = true;

    updateData.metadata = JSON.stringify(newMetadata);

    // 更新记录
    const updatedCard = await prisma.receivedCard.update({
      where: { id: cardId },
      data: updateData,
    });

    // 返回转换后的数据
    return NextResponse.json({
      id: updatedCard.id,
      postcardId: updatedCard.postcardId,
      postcardIdConfirmed: updatedCard.postcardIdConfirmed,
      senderUsername: newMetadata.senderUsername || null,
      senderCountry: updatedCard.country,
      senderCity: updatedCard.city,
      handwrittenText: updatedCard.ocrText,
      translatedText: newMetadata.translatedText || null,
      detectedLang: newMetadata.detectedLang || null,
      ocrConfidence: newMetadata.ocrConfidence || null,
      backImageUrl: updatedCard.imageUrl,
      frontImageUrl: newMetadata.frontImageUrl || null,
      isFavorite: updatedCard.isFavorite,
      isOcrManualEdit: true,
      createdAt: updatedCard.createdAt,
    });
  } catch (error: any) {
    // console.error('Error updating received card:', error);

    if (error.message === 'Unauthorized' || error.message === 'Session expired') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      { error: '更新收信记录失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/received-cards/[id]
 * 删除收信记录
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getLocalUserId();
    const { id: cardId } = await params;

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

    await prisma.receivedCard.delete({
      where: { id: cardId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: '删除收信记录失败' },
      { status: 500 }
    );
  }
}
