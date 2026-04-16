import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  
  // 安全检查：防止目录遍历攻击
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }
  
  const filePath = path.join(process.cwd(), 'data', 'received', filename);
  
  // 检查文件是否存在
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  }
  
  // 读取文件
  const fileBuffer = fs.readFileSync(filePath);
  
  // 返回图片，设置适当的缓存头
  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=86400', // 24小时缓存
    },
  });
}
