import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';

const COOKIE_NAME = 'admin_auth';

function hmacSign(secret: string, data: string): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

export async function POST(request: Request) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return NextResponse.json({ error: '认证未启用' }, { status: 403 });
  }

  const { password: input } = await request.json();

  if (input !== password) {
    return NextResponse.json({ error: '密码错误' }, { status: 401 });
  }

  const token = hmacSign(password, 'postwizard-admin');
  const res = NextResponse.json({ success: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 天
  });

  return res;
}
