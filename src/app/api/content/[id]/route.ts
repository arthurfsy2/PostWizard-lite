import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLocalUserId } from '@/lib/local-user';
/**
 * GET /api/content/[id]
 * 历史详情兼容接口：同时支持 GeneratedContent.id、Postcard.id、Postcard.postcardId
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getLocalUserId();

    const { id } = await params;
    const trimmedId = id?.trim();

    if (!trimmedId) {
      return NextResponse.json(
        { success: false, error: '缺少内容 ID' },
        { status: 400 }
      );
    }

    let generatedContent = await prisma.generatedContent.findFirst({
      where: {
        id: trimmedId,
        userId: userId,
      },
      include: {
        postcard: true,
      },
    });

    // 如果找到的记录未选中，检查同 postcardId 下是否有已选中的版本
    if (generatedContent && !generatedContent.selected) {
      const selectedVersion = await prisma.generatedContent.findFirst({
        where: {
          postcardId: generatedContent.postcardId,
          userId: userId,
          selected: true,
        },
        include: {
          postcard: true,
        },
      });
      if (selectedVersion) {
        generatedContent = selectedVersion;
      }
    }

    if (!generatedContent) {
      let postcard = await prisma.postcard.findFirst({
        where: {
          userId: userId,
          OR: [
            { id: trimmedId },
            { postcardId: trimmedId },
          ],
        },
      });

      if (!postcard) {
        const contentByPostcardCode = await prisma.generatedContent.findFirst({
          where: {
            userId: userId,
            postcard: {
              postcardId: trimmedId,
            },
          },
          include: {
            postcard: true,
          },
          orderBy: [
            { selected: 'desc' },
            { createdAt: 'desc' },
          ],
        });

        generatedContent = contentByPostcardCode;
      } else {
        generatedContent = await prisma.generatedContent.findFirst({
          where: {
            userId: userId,
            postcardId: postcard.id,
          },
          include: {
            postcard: true,
          },
          orderBy: [
            { selected: 'desc' },
            { createdAt: 'desc' },
          ],
        });
      }
    }

    if (!generatedContent) {
      return NextResponse.json(
        { success: false, error: '内容不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: generatedContent.id,
        contentTitle: generatedContent.contentTitle,
        contentBody: generatedContent.contentBody,
        contentEn: generatedContent.content || generatedContent.contentBody,
        contentZh: generatedContent.contentZh,
        tone: generatedContent.tone,
        language: generatedContent.language,
        weather: null,
        localNews: null,
        personalStory: null,
        matchedMaterials: [],
        isFavorite: false,
        isHandwritten: generatedContent.isHandwritten,
        wordCount: generatedContent.contentBody?.length || 0,
        usedTokens: generatedContent.usedTokens,
        createdAt:
          generatedContent.createdAt instanceof Date
            ? generatedContent.createdAt.toISOString()
            : generatedContent.createdAt,
        updatedAt:
          generatedContent.updatedAt instanceof Date
            ? generatedContent.updatedAt.toISOString()
            : generatedContent.updatedAt,
        postcard: generatedContent.postcard
          ? {
              id: generatedContent.postcard.id,
              recipientName: generatedContent.postcard.recipientName,
              recipientCountry: generatedContent.postcard.recipientCountry,
              recipientCity: generatedContent.postcard.recipientCity,
              recipientAddress: generatedContent.postcard.recipientAddress,
              postcardId: generatedContent.postcard.postcardId,
              distance: generatedContent.postcard.distance,
              recipientInterests: generatedContent.postcard.recipientInterests,
              recipientDislikes: generatedContent.postcard.recipientDislikes,
              contentPreference: generatedContent.postcard.contentPreference,
              cardPreference: generatedContent.postcard.cardPreference,
              languagePreference: generatedContent.postcard.languagePreference,
              specialRequests: generatedContent.postcard.specialRequests,
              messageToSender: generatedContent.postcard.messageToSender,
            }
          : null,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || '获取内容详情失败',
      },
      { status: 500 }
    );
  }
}
