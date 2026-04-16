import { NextRequest, NextResponse } from 'next/server';
import { logVisit } from '../lib/services/visitService';

// 获取客户端真实 IP
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  if (forwarded) {
    // x-forwarded-for 可能是逗号分隔的多个 IP，第一个是真实客户端 IP
    return forwarded.split(',')[0].trim();
  }
  if (realIp) {
    return realIp.trim();
  }
  // 回退到 socket 远程地址
  return request.ip ?? request.socket.remoteAddress ?? 'unknown';
}

// 简单的 User-Agent 解析
function parseUserAgent(userAgent: string) {
  if (!userAgent) return { device: 'Unknown' };

  if (userAgent.includes('Mobile')) {
    return { device: 'Mobile' };
  } else if (userAgent.includes('Tablet')) {
    return { device: 'Tablet' };
  } else {
    return { device: 'Desktop' };
  }
}

// 简单的地理位置解析（实际应用中可以使用 IP 地理定位服务）
async function parseGeoLocation(ip: string) {
  // 这里简化处理，实际项目中可以调用第三方 API
  // 比如：ipapi.co, ipgeolocation.io 等
  if (!ip || ip === 'unknown') {
    return { country: 'Unknown', city: 'Unknown' };
  }

  // 简单的 IP 段判断示例（仅作演示）
  if (ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return { country: 'Local Network', city: 'Local' };
  }

  // 这里可以添加真实的 IP 地理定位逻辑
  return { country: 'Unknown', city: 'Unknown' };
}

export async function logVisitMiddleware(request: NextRequest) {
  try {
    const ip = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || '';
    const referer = request.headers.get('referer') || '';
    const path = request.nextUrl.pathname;
    
    // 从 cookies 或 headers 获取 sessionId
    let sessionId = request.cookies.get('session-id')?.value;
    if (!sessionId) {
      sessionId = crypto.randomUUID();
    }

    // 从 cookies 获取用户信息
    const token = request.cookies.get('token')?.value;
    let userId: string | undefined;

    if (token) {
      // 这里需要验证 token 并获取用户 ID
      // 简化处理，实际应该从 session 中获取
      try {
        // 这里可以添加 token 验证逻辑
        // const payload = verifyToken(token);
        // userId = payload.userId;
      } catch (error) {
        // token 无效，不记录用户 ID
      }
    }

    // 获取地理位置信息
    const geo = await parseGeoLocation(ip);

    // 记录访问日志
    await logVisit({
      ip,
      userAgent,
      path,
      referer,
      country: geo.country,
      city: geo.city,
      userId,
      sessionId,
    });

    // 如果是新的 session，设置 cookie
    const response = NextResponse.next();
    if (!request.cookies.get('session-id')) {
      response.cookies.set('session-id', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 天
      });
    }

    return response;
  } catch (error) {
    console.error('访问日志中间件错误:', error);
    return NextResponse.next();
  }
}