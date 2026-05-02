import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLocalUserId } from '@/lib/local-user';
import { translateMessage } from '@/lib/services/sentimentAnalysis';
import { getConfigForPurpose } from '@/lib/services/ai-config';

/**
 * POST /api/arrivals/translate
 *
 * 单条翻译：{ postcardId: string } → JSON 响应
 * 批量翻译：{ batch: true } → SSE 流式响应
 */
export async function POST(request: NextRequest) {
  try {
    const userId = getLocalUserId();
    const body = await request.json();

    // 批量模式 → SSE
    if (body.batch) {
      const isMainlyChinese = (msg: string) => {
        if (!msg) return false;
        const nonAscii = (msg.match(/[^\x00-\x7F]/g) || []).length;
        return nonAscii / msg.length > 0.5;
      };

      const all = await prisma.messageAnalysis.findMany({
        where: { userId },
        select: { id: true, postcardId: true, message: true, translation: true },
      });
      // 排除已有翻译的 + 中文/繁体留言（不需要翻译）
      const missing = all.filter(r => !r.translation && !isMainlyChinese(r.message));

      if (missing.length === 0) {
        return new Response(
          `data: ${JSON.stringify({ done: true, translated: 0, total: 0 })}\n\n`,
          { headers: sseHeaders() }
        );
      }

      const modelVersion = (await getConfigForPurpose('text')).model;
      const CONCURRENCY = 5;

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const send = (data: any) => {
            try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch {}
          };

          const keepalive = setInterval(() => {
            try { controller.enqueue(encoder.encode(': keepalive\n\n')); } catch {}
          }, 2000);

          send({ started: true, total: missing.length });

          let translated = 0;
          let completed = 0;

          // 并发处理，每批 CONCURRENCY 条
          for (let i = 0; i < missing.length; i += CONCURRENCY) {
            const batch = missing.slice(i, i + CONCURRENCY);
            const results = await Promise.allSettled(
              batch.map(async (record) => {
                const translation = await translateMessage(record.message!);
                if (translation) {
                  await prisma.messageAnalysis.update({
                    where: { id: record.id },
                    data: { translation, translationModel: modelVersion },
                  });
                }
                return !!translation;
              })
            );

            for (const r of results) {
              completed++;
              if (r.status === 'fulfilled' && r.value) translated++;
            }
            send({ progress: completed, total: missing.length, translated });
          }

          clearInterval(keepalive);
          send({ done: true, translated, total: missing.length });
          try { controller.close(); } catch {}
        },
      });

      return new Response(stream, { headers: sseHeaders() });
    }

    // 单条模式 → JSON
    const { postcardId } = body;
    if (!postcardId || typeof postcardId !== 'string') {
      return NextResponse.json({ success: false, error: '缺少 postcardId' }, { status: 400 });
    }

    const record = await prisma.messageAnalysis.findFirst({
      where: { postcardId, userId },
      select: { id: true, message: true },
    });

    if (!record) {
      return NextResponse.json({ success: false, error: '记录不存在' }, { status: 404 });
    }

    const translation = await translateMessage(record.message!);
    if (!translation) {
      return NextResponse.json({ success: false, error: '翻译失败或无需翻译（中文留言）' }, { status: 400 });
    }

    const modelVersion = (await getConfigForPurpose('text')).model;
    await prisma.messageAnalysis.update({
      where: { id: record.id },
      data: { translation, translationModel: modelVersion },
    });

    return NextResponse.json({ success: true, translation });
  } catch (error) {
    console.error('[arrivals/translate] 错误:', error);
    return NextResponse.json(
      { success: false, error: '翻译失败，请稍后重试' },
      { status: 500 }
    );
  }
}

function sseHeaders() {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  };
}
