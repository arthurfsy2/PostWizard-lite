import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLocalUserId } from '@/lib/local-user';
import { recognizePostcard } from '@/lib/services/ocrService';
import { checkDuplicateReceivedCard } from '@/lib/helpers/duplicateChecker';
import { autoEnhanceImage } from '@/lib/services/imageProcessingService';
import { gachaService } from '@/lib/services/gachaService';
import { isFreeTier } from '@/lib/services/ai-config';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { randomUUID } from 'crypto';

export const bodySizeLimit = '100mb';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024;

// 免费 tier 限流参数（15 RPM）
const FREE_CONCURRENCY = 3;
const FREE_OCR_INTERVAL_MS = 5000;
// 付费 tier 参数（1000+ RPM）
const PAID_CONCURRENCY = 10;

// 请求间隔控制（免费 tier 使用）
let lastOcrTime = 0;

async function throttleOcr(intervalMs: number) {
  const now = Date.now();
  const elapsed = now - lastOcrTime;
  if (elapsed < intervalMs) {
    await new Promise(resolve => setTimeout(resolve, intervalMs - elapsed));
  }
  lastOcrTime = Date.now();
}

function extractPostcardId(filename: string): string | null {
  const name = path.basename(filename, path.extname(filename));
  const match = name.match(/^([A-Z]{2}-\d+)$/);
  return match ? match[1] : null;
}

function cleanupFile(filePath: string) {
  setTimeout(() => {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (e: any) {
      console.warn('[BatchUpload] Failed to delete temp file:', e.message);
    }
  }, 500);
}

/**
 * 处理单张图片：OCR → 去重 → 保存 → 抽卡
 */
async function processOne(
  userId: string,
  image: File,
  dataDir: string,
  tmpDir: string,
  ocrIntervalMs: number = 0,
): Promise<{ index: number; status: string; card?: any; gacha?: any; duplicateInfo?: any; error?: string }> {
  // 验证格式
  if (!ALLOWED_TYPES.includes(image.type)) {
    return { index: 0, status: 'error', error: '不支持的文件格式' };
  }
  if (image.size > MAX_SIZE) {
    return { index: 0, status: 'error', error: '文件大小超过 10MB' };
  }

  // 保存临时文件
  const ext = path.extname(image.name) || '.jpg';
  const tmpFilename = `${Date.now()}-${randomUUID().substring(0, 8)}${ext}`;
  const tmpPath = path.join(tmpDir, tmpFilename);
  const buffer = Buffer.from(await image.arrayBuffer());
  fs.writeFileSync(tmpPath, buffer);

  // OCR 识别
  let ocrResult: any = null;
  let ocrQuotaExhausted = false;
  try {
    if (ocrIntervalMs > 0) await throttleOcr(ocrIntervalMs);
    const base64 = buffer.toString('base64');
    ocrResult = await recognizePostcard(base64);
  } catch (ocrError: any) {
    const is429 = ocrError.message?.includes('429') || ocrError.message?.includes('rate limit');
    if (is429) ocrQuotaExhausted = true;

    // 429 或有文件名 ID 时继续处理，否则返回错误
    const filenameId = extractPostcardId(image.name);
    if (!is429 && !filenameId) {
      cleanupFile(tmpPath);
      return { index: 0, status: 'error', error: `OCR 失败: ${ocrError.message}` };
    }
    // 用文件名 ID 作为 fallback
    if (filenameId) {
      ocrResult = { postcardId: filenameId };
    }
  }

  // 文件名 ID 优先
  const filenameId = extractPostcardId(image.name);
  if (filenameId) {
    if (ocrResult) {
      if (ocrResult.postcardId && ocrResult.postcardId !== filenameId) {
        console.log(`[BatchUpload] 文件名 ID "${filenameId}" 覆盖 OCR 识别 "${ocrResult.postcardId}"`);
      } else if (!ocrResult.postcardId) {
        console.log(`[BatchUpload] 文件名 ID "${filenameId}" 补充了 OCR 未识别的 ID`);
      }
      ocrResult.postcardId = filenameId;
    } else {
      ocrResult = { postcardId: filenameId };
      console.log(`[BatchUpload] 文件名 ID "${filenameId}" 作为 fallback`);
    }
  }

  // 去重检查
  if (ocrResult?.postcardId) {
    const duplicate = await checkDuplicateReceivedCard(ocrResult.postcardId, userId);
    if (duplicate.exists && duplicate.receivedCard) {
      cleanupFile(tmpPath);
      return {
        index: 0,
        status: 'duplicate',
        duplicateInfo: {
          postcardId: duplicate.receivedCard.postcardId,
          existingCardId: duplicate.receivedCard.id,
          country: duplicate.receivedCard.country,
        },
      };
    }
  }

  // OCR 结果校验：手写内容为空则跳过入库
  if (!ocrResult?.handwrittenText || ocrResult.handwrittenText.trim().length === 0) {
    cleanupFile(tmpPath);
    return {
      index: 0,
      status: 'error',
      error: 'OCR 未能识别出手写内容，已跳过入库',
    };
  }

  // 保存图片到最终位置
  let backImageUrl: string;
  try {
    const finalFilename = ocrResult?.postcardId
      ? `${ocrResult.postcardId}.webp`
      : `${path.basename(tmpFilename, ext)}.webp`;
    const finalPath = path.join(dataDir, finalFilename);
    await sharp(tmpPath).webp({ quality: 90 }).toFile(finalPath);
    cleanupFile(tmpPath);
    backImageUrl = `/api/images/received/${finalFilename}`;
  } catch (moveError: any) {
    cleanupFile(tmpPath);
    return { index: 0, status: 'error', error: `图片保存失败: ${moveError.message}` };
  }

  // 创建数据库记录
  const receivedCard = await prisma.receivedCard.create({
    data: {
      userId,
      country: ocrResult?.senderCountry || 'UN',
      city: ocrResult?.senderCity,
      postcardId: ocrResult?.postcardId,
      imageUrl: backImageUrl,
      originalImageUrl: backImageUrl,
      imageProcessingStatus: 'pending',
      ocrText: ocrResult?.handwrittenText,
      ocrModel: ocrResult?.model || null,
      metadata: ocrResult ? JSON.stringify({
        senderUsername: ocrResult?.senderUsername,
        detectedLang: ocrResult?.detectedLanguage,
        ocrConfidence: ocrResult?.confidence,
        translatedText: ocrResult?.translatedText,
      }) : null,
    },
  });

  // 异步图片增强（不阻塞）
  setImmediate(async () => {
    try {
      await autoEnhanceImage(receivedCard.id, userId);
    } catch (e) {
      console.error('[BatchAutoEnhance] Failed:', e);
    }
  });

  // 抽卡（AI 评价）
  let gachaResult: any = null;
  try {
    let ocrContent = ocrResult?.handwrittenText || '';
    if (!ocrContent || ocrContent.length < 5) {
      ocrContent = `来自${ocrResult?.senderCountry || '未知国家'}的明信片`;
    }
    gachaResult = await gachaService.draw(
      userId,
      ocrResult?.postcardId || receivedCard.id,
      ocrContent,
    );
  } catch (gachaError: any) {
    console.error('[BatchGacha] Failed for card:', receivedCard.id, gachaError.message);
  }

  // 解析 metadata
  let metadata: any = {};
  try {
    metadata = receivedCard.metadata ? JSON.parse(receivedCard.metadata) : {};
  } catch { metadata = {}; }

  return {
    index: 0,
    status: 'success',
    card: {
      id: receivedCard.id,
      postcardId: receivedCard.postcardId,
      senderUsername: metadata.senderUsername,
      senderCountry: receivedCard.country,
      senderCity: receivedCard.city,
      handwrittenText: receivedCard.ocrText,
      translatedText: metadata.translatedText,
      detectedLang: metadata.detectedLang,
      backImageUrl: receivedCard.imageUrl,
      ocrQuotaExhausted,
    },
    gacha: gachaResult ? {
      rarity: gachaResult.rarity,
      cardName: gachaResult.cardName,
      description: gachaResult.description,
      imageUrl: gachaResult.imageUrl,
      luckyLevel: gachaResult.luckyLevel,
      luckyBonus: gachaResult.luckyBonus,
      aiEvaluation: gachaResult.aiEvaluation,
    } : null,
  };
}

/**
 * POST /api/received-cards/batch
 * 批量上传，SSE 流式返回，每张完成即推送
 */
export async function POST(request: NextRequest) {
  const userId = getLocalUserId();
  const formData = await request.formData();

  const images: File[] = [];
  const indices: number[] = []; // 前端传入的原始队列 index
  for (const [key, value] of formData.entries()) {
    if (key === 'images' || key.startsWith('images[')) {
      if (value instanceof File) images.push(value);
    }
  }
  // 解析 indices（可选，前端通过隐藏字段传入）
  const indicesStr = formData.get('indices') as string | null;
  if (indicesStr) {
    try { indices.push(...JSON.parse(indicesStr)); } catch {}
  }
  // 如果没有传入 indices，默认用 0, 1, 2...
  while (indices.length < images.length) indices.push(indices.length);

  if (images.length === 0) {
    return new Response(JSON.stringify({ error: '请至少上传一张图片' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 确保目录存在
  const dataDir = path.join(process.cwd(), 'data', 'received');
  const tmpDir = path.join(dataDir, '.tmp');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  // SSE 流式响应
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // 心跳：每 2 秒发一个空注释，防止 proxy 缓冲，同时让前端知道连接活着
      const keepalive = setInterval(() => {
        try { controller.enqueue(encoder.encode(': keepalive\n\n')); } catch {}
      }, 2000);

      // 通知前端开始处理
      send({ started: true, total: images.length });

      let successCount = 0;
      let duplicateCount = 0;
      let errorCount = 0;

      // 根据 tier 决定并发和限流
      const isFree = await isFreeTier('ocr');
      const concurrency = isFree ? FREE_CONCURRENCY : PAID_CONCURRENCY;
      const ocrIntervalMs = isFree ? FREE_OCR_INTERVAL_MS : 0;
      console.log(`[BatchUpload] tier: ${isFree ? 'free' : 'paid'}, concurrency: ${concurrency}, ocrInterval: ${ocrIntervalMs}ms`);

      // 并发处理，带索引追踪
      let nextIndex = 0;
      const results = new Map<number, any>();

      const worker = async () => {
        while (nextIndex < images.length) {
          const idx = nextIndex++;
          const image = images[idx];

          try {
            const result = await processOne(userId, image, dataDir, tmpDir, ocrIntervalMs);
            result.index = indices[idx]; // 返回前端的原始队列 index

            if (result.status === 'success') successCount++;
            else if (result.status === 'duplicate') duplicateCount++;
            else errorCount++;

            // 发送单条结果
            send(result);
          } catch (err: any) {
            errorCount++;
            send({ index: idx, status: 'error', error: err.message });
          }
        }
      };

      // 启动 N 个并发 worker
      const workers = Array.from(
        { length: Math.min(concurrency, images.length) },
        () => worker(),
      );
      await Promise.all(workers);

      // 发送完成信号
      send({
        done: true,
        summary: {
          total: images.length,
          success: successCount,
          duplicate: duplicateCount,
          error: errorCount,
        },
      });

      clearInterval(keepalive);
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',  // 禁止 nginx/proxy 缓冲
    },
  });
}
