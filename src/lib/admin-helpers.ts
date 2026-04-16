import { NextRequest } from 'next/server';
import { getCurrentUser } from './auth-helpers';

// 管理员邮箱（环境变量）
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';

/**
 * 验证管理员权限
 * @returns 是否为管理员
 */
export async function verifyAdmin(request: NextRequest): Promise<boolean> {
  if (!ADMIN_EMAIL) {
    // console.error('ADMIN_EMAIL environment variable is not set');
    return false;
  }

  const userId = getLocalUserId();
  if (!user) {
    return false;
  }

  return user.email === ADMIN_EMAIL;
}

/**
 * 管理员未授权响应
 */
export function adminUnauthorizedResponse() {
  return {
    error: '无权限访问',
    status: 403,
  };
}
