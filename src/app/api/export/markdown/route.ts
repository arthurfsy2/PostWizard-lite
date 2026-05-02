import { NextRequest, NextResponse } from 'next/server';
import { exportService } from '@/lib/services/exportService';

/**
 * POST /api/export/markdown
 * 导出为 Markdown 格式
 * 
 * 支持两种请求格式：
 * 1. GET /api/export/markdown?contentId=xxx - 从数据库获取内容
 * 2. POST /api/export/markdown - 传入 JSON 数据
 *    - 单条: { contentId: string, options?: {...} }
 *    - 批量: { contentIds: string[], options?: {...} }
 */
export async function POST(request: NextRequest) {
  try {
    // 优先从 URL 查询参数获取 contentId
    const contentId = request.nextUrl.searchParams.get('contentId');

    if (contentId) {
      // 单条导出 - 从数据库获取内容
      const { prisma } = await import('@/lib/prisma');
      const generatedContent = await prisma.sentCardContent.findUnique({
        where: { id: contentId },
      });

      if (!generatedContent) {
        return NextResponse.json(
          { success: false, error: '内容不存在' },
          { status: 404 }
        );
      }

      // 获取关联的 postcard 信息
      let postcard = null;
      if (generatedContent.postcardId) {
        postcard = await prisma.postcard.findUnique({
          where: { id: generatedContent.postcardId },
        });
      }

      const postcardData = {
        postcardId: postcard?.postcardId || 'Unknown',
        recipientName: postcard?.recipientName || 'Unknown',
        country: postcard?.recipientCountry || 'Unknown',
        city: postcard?.recipientCity || 'Unknown',
        senderCity: 'Shenzhen',
        greeting: 'Hello!',
        body: generatedContent.contentBody,
        closing: 'Best wishes!',
        weather: 'Sunny',
        localCulture: 'Local culture info',
        personalTouch: generatedContent.isHandwritten ? 'Written by hand' : '',
      };
      
      const result = await exportService.exportToMarkdown(postcardData);

      return NextResponse.json({
        success: true,
        markdown: result.content,
        filename: result.filename,
      });
    } else {
      // 从请求体获取数据
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
          postcardId: postcard?.postcardId || content.id.slice(0, 8), // 使用真实的 postcardId 或内容ID前8位
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

      // 批量导出
      const result = await exportService.exportBatchToMarkdown(postcardDataArray, options);

      return NextResponse.json({
        success: true,
        markdown: result.content,
        filename: result.filename,
        count: postcardDataArray.length,
      });
    }
  } catch (error: any) {
    // console.error('导出 Markdown 失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '导出 Markdown 失败',
      },
      { status: 500 },
    );
  }
}
