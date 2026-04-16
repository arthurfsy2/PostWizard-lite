import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLocalUserId } from '@/lib/local-user';
import { emailService } from '@/lib/services/emailService';
/**
 * POST /api/arrivals/search
 * 搜索抵达确认邮件（返回计数，不下载内容）
 * 
 * Request body:
 * - configId: 邮箱配置 ID（必填）
 * - folder: 邮箱文件夹（可选，默认 INBOX）
 * - limit: 最大返回数量（可选，默认 20）
 * 
 * Response:
 * - 200: 成功，返回邮件计数和摘要
 * - 401: 未登录
 * - 404: 邮箱配置不存在
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户登录状态
    const userId = getLocalUserId();

    // 2. 解析请求参数
    const body = await request.json();
    const {
      configId,
      folder = 'INBOX',
      limit = 20,
    } = body;

    if (!configId) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少邮箱配置 ID',
          errorCode: 'MISSING_CONFIG_ID',
        },
        { status: 400 },
      );
    }

    // 3. 验证邮箱配置存在且属于当前用户
    const emailConfig = await prisma.emailConfig.findFirst({
      where: {
        id: configId,
        userId: userId,
      },
    });

    if (!emailConfig) {
      return NextResponse.json(
        {
          success: false,
          error: '邮箱配置不存在或无权访问',
          errorCode: 'CONFIG_NOT_FOUND',
        },
        { status: 404 },
      );
    }

    // 4. 搜索抵达确认邮件
    // 返回：UID 列表 + 总数
    const searchQuery = 'Hurray! Your postcard';
    
    let uids: number[] = [];
    try {
      // 获取所有匹配的 UID 列表（不下载内容）
      uids = await emailService.searchEmailUids(configId, {
        folder,
        searchQuery,
      });
    } catch (error: any) {
      // 网络超时
      if (error.message?.includes('超时') || error.message?.includes('timeout')) {
        return NextResponse.json(
          {
            success: false,
            error: '连接邮箱服务器超时，请稍后重试',
            errorCode: 'TIMEOUT',
          },
          { status: 504 },
        );
      }

      // 认证失败
      if (error.message?.includes('认证') || 
          error.message?.includes('Invalid credentials') ||
          error.message?.includes('login failed')) {
        return NextResponse.json(
          {
            success: false,
            error: '邮箱认证失败，请检查邮箱配置',
            errorCode: 'AUTH_FAILED',
          },
          { status: 401 },
        );
      }

      // 文件夹不存在
      if (error.message?.includes('不存在') || 
          error.message?.includes('not found') ||
          error.message?.includes('does not exist')) {
        return NextResponse.json(
          {
            success: false,
            error: '邮箱文件夹不存在，请检查文件夹路径',
            errorCode: 'FOLDER_NOT_FOUND',
            details: error.message,
          },
          { status: 400 },
        );
      }

      // 其他错误
      console.error('[Arrival Search] Error:', error);
      return NextResponse.json(
        {
          success: false,
          error: '搜索邮件失败',
          errorCode: 'SEARCH_FAILED',
          details: error.message,
        },
        { status: 500 },
      );
    }

    // 5. 获取数据库中已保存的 postcardId（用于去重）
    const existingReplies = await prisma.arrivalReply.findMany({
      where: { userId: userId },
      select: { postcardId: true },
    });
    const existingIds = new Set(existingReplies.map(r => r.postcardId).filter(Boolean));
    
    // 5.1 计算总邮件数
    const totalCount = uids.length;
    
    // 6. 获取邮件主题并提取 postcardId，计算实际的新邮件数
    // 关键修复：不再简单比较数量，而是实际检查每封邮件的 postcardId
    let actualNewCount = 0;
    let actualExistingCount = 0;
    
    try {
      // 使用现有的 fetchEmailHeaders 函数获取邮件主题
      const { fetchEmailHeaders } = await import('@/lib/services/imapService');
      
      // 获取所有邮件的头部信息
      const headers = await fetchEmailHeaders(configId, uids, folder);
      
      // 提取每封邮件的 postcardId 并比对
      for (const email of headers) {
        const subject = email.subject || '';
        // 提取 postcardId，格式如 "XX-12345"
        const match = subject.match(/([A-Z]{2}-\d+)/);
        if (match) {
          const postcardId = match[1];
          if (existingIds.has(postcardId)) {
            actualExistingCount++;
          } else {
            actualNewCount++;
          }
        } else {
          // 无法提取 postcardId，视为新邮件
          actualNewCount++;
        }
      }
    } catch (fetchError) {
      console.error('[Arrival Search] Error fetching email subjects:', fetchError);
      // 如果获取失败，回退到旧逻辑（不准确但不会报错）
      actualExistingCount = 0;
      actualNewCount = totalCount;
    }
    
    // 7. 保存到数据库（使用 upsert 确保用户记录存在）
    await prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email: 'local@postwizard.local',
        arrivalsTotalCount: totalCount,
        arrivalsLastSearchedAt: new Date(),
        arrivalsFolder: folder,
      },
      update: {
        arrivalsTotalCount: totalCount,
        arrivalsLastSearchedAt: new Date(),
        arrivalsFolder: folder,
      },
    });
    
    return NextResponse.json({
      success: true,
      data: {
        totalCount,
        existingCount: actualExistingCount,
        newCount: actualNewCount,
        folder,
        searchQuery,
        // 返回所有 UID 列表给解析 API 使用（不再限制数量）
        uids: uids, // 返回所有 UID，避免遗漏
      },
    });

  } catch (error) {
    console.error('[Arrival Search] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '服务器内部错误',
        errorCode: 'INTERNAL_ERROR',
      },
      { status: 500 },
    );
  }
}
