import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLocalUserId } from '@/lib/local-user';
import { recognizePostcard } from '@/lib/services/ocrService';
import path from 'path';
import fs from 'fs';

/**
 * POST /api/received-cards/[id]/rerun-ocr
 * 重新运行 OCR 识别（开源版：无额度限制）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getLocalUserId();
    const { id: cardId } = await params;

    // 1. 获取卡片信息
    const receivedCard = await prisma.receivedCard.findUnique({
      where: { id: cardId, userId },
    });

    if (!receivedCard) {
      return NextResponse.json(
        { error: '卡片不存在' },
        { status: 404 }
      );
    }

    // 2. 检查是否有背面图片
    if (!receivedCard.backImageUrl) {
      return NextResponse.json(
        { error: '没有可识别的图片' },
        { status: 400 }
      );
    }

    // 3. 获取图片 Base64 并调用 OCR
    let imageBase64: string;
    try {
      const imagePath = path.join(process.cwd(), 'public', receivedCard.backImageUrl.replace(/^\//, ''));
      
      if (fs.existsSync(imagePath)) {
        const imageBuffer = fs.readFileSync(imagePath);
        imageBase64 = imageBuffer.toString('base64');
      } else {
        const vercelPath = path.join('/tmp', receivedCard.backImageUrl.replace(/^\/api\/uploads\//, ''));
        if (fs.existsSync(vercelPath)) {
          const imageBuffer = fs.readFileSync(vercelPath);
          imageBase64 = imageBuffer.toString('base64');
        } else {
          return NextResponse.json(
            { error: '图片文件不存在' },
            { status: 400 }
          );
        }
      }
    } catch (error) {
      return NextResponse.json(
        { error: '读取图片失败' },
        { status: 500 }
      );
    }

    // 4. 调用 OCR
    let ocrResult: any = null;
    try {
      ocrResult = await recognizePostcard(imageBase64);
    } catch (error: any) {
      return NextResponse.json(
        { error: `OCR 识别失败：${error.message}` },
        { status: 500 }
      );
    }

    // 5. 更新记录
    const now = new Date();
    const updatedCard = await prisma.receivedCard.update({
      where: { id: cardId },
      data: {
        senderUsername: ocrResult?.senderUsername,
        senderCountry: ocrResult?.senderCountry,
        senderCity: ocrResult?.senderCity,
        handwrittenText: ocrResult?.handwrittenText,
        translatedText: ocrResult?.translatedText,
        detectedLang: ocrResult?.detectedLanguage,
        ocrRawResult: ocrResult ? JSON.stringify(ocrResult) : null,
        ocrConfidence: ocrResult?.confidence,
        postcardId: ocrResult?.postcardId || null,
        postcardIdConfirmed: false,
        isOcrManualEdit: false,
        lastRerunAt: now,
        rerunCount: { increment: 1 },
      },
    });

    return NextResponse.json({
      success: true,
      isReuse: false,
      message: '识别成功',
      postcardId: updatedCard.postcardId,
      senderUsername: updatedCard.senderUsername,
      senderCountry: updatedCard.senderCountry,
      senderCity: updatedCard.senderCity,
      handwrittenText: updatedCard.handwrittenText,
      detectedLang: updatedCard.detectedLang,
      ocrConfidence: updatedCard.ocrConfidence,
      postcardIdConfirmed: updatedCard.postcardIdConfirmed,
    });
  } catch (error: any) {
    console.error('[Rerun OCR API] 错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '识别失败',
      },
      { status: 500 }
    );
  }
}
