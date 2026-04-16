import { NextRequest, NextResponse } from 'next/server';
import { exportService } from '@/lib/services/exportService';

/**
 * POST /api/export/html
 * 导出为 HTML 格式
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      contentIds,
      postcardIds,
      includeMetadata = true,
    } = body;

    // TODO: 需要从数据库获取实际的 PostcardContent 数据
    // 当前是 mock 实现，返回空内容
    const mockPostcard = {
      postcardId: postcardIds?.[0] || 'unknown',
      recipientName: 'Unknown',
      country: 'Unknown',
      city: 'Unknown',
      senderCity: 'Shenzhen',
      greeting: 'Hello!',
      body: 'Postcard content here.',
      closing: 'Best wishes!',
      weather: 'Sunny',
      localCulture: 'Local culture info',
      personalTouch: 'Personal touch here',
    };
    
    const result = await exportService.exportToHtml(mockPostcard);

    return new NextResponse(result.content, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${result.filename}"`,
      },
    });
  } catch (error: any) {
    // console.error('导出 HTML 失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '导出 HTML 失败',
      },
      { status: 500 },
    );
  }
}
