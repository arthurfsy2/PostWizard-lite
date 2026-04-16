import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLocalUserId } from '@/lib/local-user';
import { getCountryCode, getCountryName } from '@/lib/country-codes';

/**
 * GET /api/arrivals
 * 获取已解析的抵达回复列表
 * 
 * Query params:
 * - page: 页码（可选，默认 1）
 * - limit: 每页数量（可选，默认 20）
 * - country: 筛选国家（可选）
 * 
 * Response:
 * - 200: 成功，返回列表和统计信息
 * - 401: 未登录
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 验证用户登录状态
    const userId = getLocalUserId();

    // 2. 解析查询参数
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const country = searchParams.get('country');

    // 3. 构建查询条件
    const where: any = { userId: userId };
    if (country) {
      // 支持 2 字母代码（如"DE"）和完整名称（如"Germany"）
      // 如果是 2 字母代码，转换为完整名称查询
      const countryName = getCountryName(country) || country;
      where.destinationCountry = {
        equals: countryName,
        mode: 'insensitive',
      };
    }

    // 4. 查询列表和用户统计（关联 MessageAnalysis 获取翻译）
    const [arrivals, dbTotal, countryStats, travelDaysStats, userStats] = await Promise.all([
      prisma.arrivalReply.findMany({
        where,
        orderBy: { arrivedAt: 'desc' },  // 按到达日期倒序（最新的在前）
        skip: (page - 1) * limit,
        take: limit,
        include: {
          // 关联查询 MessageAnalysis，获取翻译内容
          messageAnalysis: {
            select: {
              translation: true,
              aiScore: true,
              primaryCategory: true,
              emotion: true,
              tags: true,
            },
          },
        },
      }),
      prisma.arrivalReply.count({ where }),
      // 统计各国家数量（按数量倒序）
      prisma.arrivalReply.groupBy({
        by: ['destinationCountry'],
        where: { userId: userId },
        _count: { destinationCountry: true },
        orderBy: { _count: { destinationCountry: 'desc' } },
      }),
      // 统计平均旅途天数
      prisma.arrivalReply.aggregate({
        where: { userId: userId, travelDays: { not: null } },
        _avg: { travelDays: true },
      }),
      // 获取用户统计（邮箱中的总数）
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          arrivalsTotalCount: true,
          arrivalsLastSearchedAt: true,
          arrivalsFolder: true,
        },
      }),
    ]);

    // 5. 构建响应
    return NextResponse.json({
      success: true,
      data: {
        arrivals,
        pagination: {
          page,
          limit,
          total: dbTotal,
          totalPages: Math.ceil(dbTotal / limit),
        },
        stats: {
          total: dbTotal, // 数据库中已解析的数量（用于"全部"按钮）
          emailTotalCount: userStats?.arrivalsTotalCount || 0, // 邮箱中的总数（用于"📧 邮箱总数"）
          avgTravelDays: travelDaysStats._avg.travelDays || 0,
          byCountry: countryStats.map(s => {
            // 尝试将国家名称转换为 2 字母代码
            const countryCode = getCountryCode(s.destinationCountry);
            return {
              country: countryCode || s.destinationCountry, // 如果找不到代码，保留原始名称
              count: s._count.destinationCountry,
              code: countryCode, // 额外返回代码，方便前端使用
            };
          }),
        },
      },
    });

  } catch (error) {
    console.error('[Arrivals GET] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取列表失败',
        errorCode: 'GET_FAILED',
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/arrivals
 * 删除指定的抵达回复记录
 * 
 * Request body:
 * - ids: 要删除的 ID 数组
 * 
 * Response:
 * - 200: 删除成功
 * - 401: 未登录
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = getLocalUserId();

    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: '缺少要删除的 ID' },
        { status: 400 },
      );
    }

    // 删除记录
    const result = await prisma.arrivalReply.deleteMany({
      where: {
        id: { in: ids },
        userId: userId, // 确保只能删除自己的记录
      },
    });

    return NextResponse.json({
      success: true,
      data: { deleted: result.count },
    });

  } catch (error) {
    console.error('[Arrivals DELETE] Error:', error);
    return NextResponse.json(
      { success: false, error: '删除失败' },
      { status: 500 },
    );
  }
}
