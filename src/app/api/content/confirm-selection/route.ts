import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { contentId, postcardId } = await request.json();

    if (!contentId || !postcardId) {
      return NextResponse.json(
        { success: false, error: '缺少 contentId 或 postcardId' },
        { status: 400 },
      );
    }

    // 取消同 postcardId 下所有已选中记录
    await prisma.generatedContent.updateMany({
      where: { postcardId, selected: true },
      data: { selected: false },
    });

    // 标记当前版本为选中
    await prisma.generatedContent.update({
      where: { id: contentId },
      data: { selected: true },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || '确认失败' },
      { status: 500 },
    );
  }
}
