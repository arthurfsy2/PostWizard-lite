import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/emails/[id]
 * 获取邮件详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const email = await prisma.email.findUnique({
      where: { id },
      include: {
        emailConfig: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        postcards: {
          select: {
            id: true,
            postcardId: true,
            recipientName: true,
            recipientCountry: true,
            status: true,
          },
        },
      },
    });

    if (!email) {
      return NextResponse.json(
        {
          success: false,
          error: '邮件不存在',
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: email,
    });
  } catch (error) {
    // console.error('获取邮件详情失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取邮件详情失败',
      },
      { status: 500 },
    );
  }
}
