import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLocalUserId } from '@/lib/local-user';

/**
 * POST /api/received-cards/check-duplicates-bulk
 * 批量检查 postcardId 是否已存在
 * Body: { postcardIds: string[] }
 * 返回: { duplicates: string[] } — 已存在的 ID 列表
 */
export async function POST(request: NextRequest) {
  try {
    const userId = getLocalUserId();
    const { postcardIds } = await request.json();

    if (!Array.isArray(postcardIds) || postcardIds.length === 0) {
      return NextResponse.json({ duplicates: [] });
    }

    const existing = await prisma.receivedCard.findMany({
      where: {
        userId,
        postcardId: { in: postcardIds },
      },
      select: { postcardId: true },
    });

    return NextResponse.json({
      duplicates: existing.map(r => r.postcardId).filter(Boolean),
    });
  } catch (error: any) {
    return NextResponse.json({ error: '批量查重失败', detail: error.message }, { status: 500 });
  }
}
