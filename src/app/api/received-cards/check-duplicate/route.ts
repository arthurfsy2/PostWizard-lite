import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLocalUserId } from '@/lib/local-user';
import { checkDuplicatePostcard } from '@/lib/helpers/duplicateChecker';

/**
 * POST /api/received-cards/check-duplicate
 * 检查明信片 ID 是否重复
 */
export async function POST(request: NextRequest) {
  try {
    const userId = getLocalUserId();
    const body = await request.json();
    const { postcardId, currentCardId } = body;

    if (!postcardId) {
      return NextResponse.json(
        { error: '缺少 postcardId 参数' },
        { status: 400 }
      );
    }

    // 使用通用检测函数
    const duplicate = await checkDuplicatePostcard(postcardId, userId);

    if (duplicate.exists && duplicate.postcard) {
      // 如果提供了 currentCardId，排除当前记录
      if (currentCardId && duplicate.postcard.id === currentCardId) {
        return NextResponse.json({
          isDuplicate: false,
        });
      }

      // 发现重复
      return NextResponse.json({
        isDuplicate: true,
        duplicateInfo: {
          postcardId: duplicate.postcard.postcardId,
          createdAt: duplicate.postcard.createdAt,
          formattedTime: duplicate.postcard.formattedTime,
          recipientName: duplicate.postcard.recipientName,
        },
      }, { status: 409 }); // 409 Conflict
    }

    return NextResponse.json({
      isDuplicate: false,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: '检测失败' },
      { status: 500 }
    );
  }
}
