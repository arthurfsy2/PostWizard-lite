import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLocalUserId } from '@/lib/local-user';
import { validateFields } from '@/lib/validate-schema-fields';

/**
 * GET /api/history
 * 获取历史记录列表（带分页和筛选）
 *
 * Query params:
 * - page: 页码（默认1）
 * - limit: 每页数量（默认20）
 * - country: 国家筛选（可选）
 * - startDate: 开始日期筛选（可选，ISO格式）
 * - endDate: 结束日期筛选（可选，ISO格式）
 */
export async function GET(request: NextRequest) {
  try {
    const userId = getLocalUserId();

    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const country = searchParams.get('country');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const skip = (page - 1) * limit;

    const where: any = { userId: userId };

    if (country) {
      where.postcard = {
        recipientCountry: {
          contains: country,
        },
      };
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const allRecords = await prisma.generatedContent.findMany({
      where,
      include: {
        postcard: {
          select: {
            id: true,
            postcardId: true,
            recipientName: true,
            recipientCountry: true,
            recipientCity: true,
            status: true,
          },
        },
      },
      orderBy: [
        { selected: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    const seenPostcardIds = new Set<string>();
    const distinctRecords = allRecords.filter((record) => {
      const postcardCode = record.postcard?.postcardId;
      if (!postcardCode || seenPostcardIds.has(postcardCode)) {
        return false;
      }
      seenPostcardIds.add(postcardCode);
      return true;
    });

    const total = distinctRecords.length;
    const paginatedHistory = distinctRecords.slice(skip, skip + limit);

    const items = paginatedHistory.map((item: any) => {
      const formatted = {
        id: item.id,
        contentTitle: item.contentTitle,
        contentBody: item.contentBody,
        contentType: item.contentType,
        tone: item.tone,
        language: item.language,
        isFavorite: false,
        isHandwritten: item.isHandwritten,
        wordCount: item.contentBody?.length || 0,
        createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
        updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : item.updatedAt,
        postcardId: item.postcard?.postcardId || null,
        recipient: item.postcard
          ? {
              id: item.postcard.id,
              name: item.postcard.recipientName,
              country: item.postcard.recipientCountry,
              city: item.postcard.recipientCity,
              status: item.postcard.status,
            }
          : null,
      };

      validateFields('GeneratedContent', formatted, {
        context: 'GET /api/history',
        allowExtraFields: true,
      });

      return formatted;
    });

    return NextResponse.json({
      success: true,
      data: {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: '获取历史记录失败',
      },
      { status: 500 }
    );
  }
}
