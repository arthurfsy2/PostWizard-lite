import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/card-templates
 * 获取所有可用模板列表（开源版：无需认证，所有模板均免费）
 */
export async function GET(request: NextRequest) {
  try {
    const templates = await prisma.cardTemplate.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    // 开源版：所有模板均不锁定
    const data = templates.map((template) => ({
      ...template,
      locked: false,
    }));

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('[CardTemplates API] Error:', error.message);
    return NextResponse.json(
      { error: '获取模板列表失败' },
      { status: 500 }
    );
  }
}
