import { NextRequest, NextResponse } from 'next/server';
import { exportService } from '@/lib/services/exportService';

/**
 * POST /api/export/pdf
 * 导出为 PDF 格式（单条或批量）
 * 
 * Body:
 * - contentIds: string[] - 内容 ID 数组
 * - options: {
 *     includeRecipient?: boolean - 是否包含收件人信息
 *     includeSignature?: boolean - 是否包含签名
 *   }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contentIds, options = {} } = body;

    if (!contentIds || !Array.isArray(contentIds) || contentIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '请提供 contentIds 数组' },
        { status: 400 }
      );
    }

    // 批量获取内容
    const { prisma } = await import('@/lib/prisma');
    const generatedContents = await prisma.sentCardContent.findMany({
      where: { id: { in: contentIds } },
    });

    if (generatedContents.length === 0) {
      return NextResponse.json(
        { success: false, error: '未找到指定的内容' },
        { status: 404 }
      );
    }

    // 获取所有相关的 postcard 信息
    const postcardIds = generatedContents
      .map(c => c.postcardId)
      .filter((id): id is string => !!id);
    
    const postcards = postcardIds.length > 0 
      ? await prisma.postcard.findMany({
          where: { id: { in: postcardIds } },
        })
      : [];

    const postcardMap = new Map(postcards.map(p => [p.id, p]));

    // 构建 postcardData 数组
    const postcardDataArray = generatedContents.map(content => {
      const postcard = content.postcardId ? postcardMap.get(content.postcardId) : null;
      return {
        postcardId: postcard?.postcardId || 'Unknown',
        recipientName: postcard?.recipientName || 'Unknown',
        country: postcard?.recipientCountry || 'Unknown',
        city: postcard?.recipientCity || 'Unknown',
        senderCity: 'Shenzhen',
        greeting: 'Hello!',
        body: content.contentBody,
        closing: 'Best wishes!',
        weather: 'Sunny',
        localCulture: 'Local culture info',
        personalTouch: content.isHandwritten ? 'Written by hand' : '',
      };
    });

    // 批量导出为 PDF
    const result = exportService.exportBatchToPdf(postcardDataArray, options);

    return NextResponse.json({
      success: true,
      pdf: result.content,
      filename: result.filename,
      count: postcardDataArray.length,
    });
  } catch (error: any) {
    // console.error('导出 PDF 失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '导出 PDF 失败',
      },
      { status: 500 },
    );
  }
}
