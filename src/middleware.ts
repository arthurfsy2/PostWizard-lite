import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COOKIE_NAME = 'admin_auth';

async function hmacSign(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return Buffer.from(sig).toString('hex');
}

export async function middleware(request: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return NextResponse.next();

  const { pathname } = request.nextUrl;

  // 放行静态资源、登录页、所有 API、Next.js 内部路径
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.ico')
  ) {
    return NextResponse.next();
  }

  // 校验 cookie
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const expected = await hmacSign(password, 'postwizard-admin');
  if (token === expected) return NextResponse.next();

  // 未认证 → 重定向到登录页
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('from', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
