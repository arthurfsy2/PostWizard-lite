import { NextRequest } from 'next/server';
import { POST as exportMarkdownPost } from '@/app/api/export/markdown/route';

/**
 * GET /api/content/[id]/export-markdown
 * 兼容旧导出链接，内部转发到 /api/export/markdown?contentId={id}
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(request.url);
  url.pathname = '/api/export/markdown';
  url.searchParams.set('contentId', id);

  const forwardedRequest = new NextRequest(url, {
    method: 'POST',
    headers: request.headers,
  });

  return exportMarkdownPost(forwardedRequest);
}
