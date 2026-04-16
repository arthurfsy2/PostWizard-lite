import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/settings/public
 * 公开获取系统配置（无需登录）
 * - newUserFreeQuota: 新用户默认免费额度
 */
export async function GET(request: NextRequest) {
  try {
    // 读取新用户默认额度配置
    const quotaSetting = await prisma.settings.findUnique({
      where: { key: 'newUserFreeQuota' },
    });

    const newUserFreeQuota = quotaSetting ? parseInt(quotaSetting.value, 10) : 50;

    return NextResponse.json({
      success: true,
      data: {
        newUserFreeQuota,
      },
    });
  } catch (error) {
    // 返回默认值
    return NextResponse.json({
      success: true,
      data: {
        newUserFreeQuota: 50,
      },
    });
  }
}
