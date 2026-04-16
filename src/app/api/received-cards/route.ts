import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLocalUserId } from '@/lib/local-user';
import { recognizePostcard } from '@/lib/services/ocrService';
import { checkDuplicateReceivedCard } from '@/lib/helpers/duplicateChecker';
import { autoEnhanceImage } from '@/lib/services/imageProcessingService';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { randomUUID } from 'crypto';

/**
 * GET /api/received-cards
 * 获取当前用户收信列表（分页）
 */
export async function GET(request: NextRequest) {
  try {
    const userId = getLocalUserId();

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const country = searchParams.get('country') || undefined;

    const where: { userId: string; country?: string; postcardId?: { contains: string; mode: 'insensitive' }; isFavorite?: boolean } = { userId };
    if (country) {
      where.country = country;
    }

    const [total, receivedCards] = await Promise.all([
      prisma.receivedCard.count({ where }),
      prisma.receivedCard.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pageSize,
        skip: (page - 1) * pageSize,
        select: {
          id: true,
          postcardId: true,
          postcardIdConfirmed: true,
          country: true,
          city: true,
          ocrText: true,
          imageUrl: true,
          processedImageUrl: true,
          originalImageUrl: true,
          isFavorite: true,
          createdAt: true,
          metadata: true,
        },
      }),
    ]);

    // 批量查询抽卡记录以获取稀有度信息（避免 N+1 问题）
    const postcardIds = receivedCards.map(card => card.postcardId).filter(Boolean);
    const gachaLogsMap = new Map<string, { rarity: string; luckyLevel: string | null }>();
    
    if (postcardIds.length > 0) {
      const gachaLogs = await prisma.userGachaLog.findMany({
        where: {
          postcardId: { in: postcardIds },
        },
        select: {
          postcardId: true,
          rarity: true,
          luckyLevel: true,
        },
      });
      
      gachaLogs.forEach(log => {
        if (log.postcardId) {
          gachaLogsMap.set(log.postcardId, {
            rarity: log.rarity,
            luckyLevel: log.luckyLevel,
          });
        }
      });
    }

    // 转换数据格式以兼容前端
    const formattedCards = receivedCards.map(card => {
      let metadata: any = {};
      try {
        metadata = card.metadata ? JSON.parse(card.metadata) : {};
      } catch (e) {
        metadata = {};
      }

      // 获取对应的抽卡记录稀有度信息
      const gachaInfo = card.postcardId ? gachaLogsMap.get(card.postcardId) : null;
      
      return {
        id: card.id,
        postcardId: card.postcardId,
        postcardIdConfirmed: card.postcardIdConfirmed,
        senderUsername: metadata.senderUsername,
        senderCountry: card.country,
        senderCity: card.city,
        handwrittenText: card.ocrText,
        translatedText: metadata.translatedText,
        detectedLang: metadata.detectedLang,
        backImageUrl: card.imageUrl,
        processedImageUrl: card.processedImageUrl,
        originalImageUrl: card.originalImageUrl,
        originalImageUrl: card.originalImageUrl,
        processedImageUrl: card.processedImageUrl,
        imageProcessingStatus: card.imageProcessingStatus,
        frontImageUrl: metadata.frontImageUrl,
        shareImageUrl: metadata.shareImageUrl,
        isPublic: metadata.isPublic,
        isFavorite: card.isFavorite,
        receivedAt: metadata.receivedAt,
        createdAt: card.createdAt,
        // 抽卡关联信息
        rarity: gachaInfo?.rarity || null,
        luckyLevel: gachaInfo?.luckyLevel || null,
      };
    });

    return NextResponse.json({
      data: formattedCards,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error: any) {
    console.error('[ReceivedCards API GET] Error:', error.message, error.code, error.meta);
    return NextResponse.json({ error: '获取收信列表失败', detail: error.message }, { status: 500 });
  }
}

/**
 * POST /api/received-cards
 * 上传明信片背面图片，调用 qwen-vl 进行 OCR 识别，创建收信记录
 */
export async function POST(request: NextRequest) {
  try {
    const userId = getLocalUserId();
    // console.log('[API] User authenticated:', userId);

    // 开源版：无额度限制

    const formData = await request.formData();
    const backImage = formData.get('backImage') as File;
    const frontImage = formData.get('frontImage') as File | null;
    const receivedAt = formData.get('receivedAt') as string | null;
    const isPublic = formData.get('isPublic') === 'true';

    if (!backImage) {
      return NextResponse.json({ error: '缺少必填参数：backImage' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/webp'];
    if (!allowedTypes.includes(backImage.type)) {
      return NextResponse.json(
        { error: '不支持的文件格式，请上传 JPG/PNG/HEIC/WEBP 格式' },
        { status: 400 }
      );
    }

    // 验证文件大小（最大 10MB）
    const maxSize = 10 * 1024 * 1024;
    if (backImage.size > maxSize) {
      return NextResponse.json({ error: '文件大小超过 10MB 限制' }, { status: 400 });
    }

    // 确保 data/received 目录存在
    const dataDir = path.join(process.cwd(), 'data', 'received');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const tmpDir = path.join(process.cwd(), 'data', 'received', '.tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    // 临时保存图片到 tmp 目录
    const saveTempImage = async (file: File): Promise<{tmpPath: string, originalName: string}> => {
      const ext = path.extname(file.name) || '.jpg';
      const filename = `${Date.now()}-${randomUUID().substring(0, 8)}${ext}`;
      const tmpPath = path.join(tmpDir, filename);
      
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(tmpPath, buffer);
      
      return { tmpPath, originalName: file.name };
    };

    // 将图片转换为 webp 并移动到最终位置
    const moveToFinalPath = async (
      tmpPath: string, 
      postcardId: string | null | undefined,
      suffix: string = ''
    ): Promise<string> => {
      const finalFilename = postcardId 
        ? `${postcardId}${suffix}.webp`
        : `${path.basename(tmpPath, path.extname(tmpPath))}${suffix}.webp`;
      const finalPath = path.join(dataDir, finalFilename);
      
      // 使用 sharp 转换为 webp
      await sharp(tmpPath)
        .webp({ quality: 90 })
        .toFile(finalPath);
      
      // 删除临时文件（延迟执行，避免 Windows 文件句柄未释放）
      setTimeout(() => {
        try {
          if (fs.existsSync(tmpPath)) {
            fs.unlinkSync(tmpPath);
          }
        } catch (e: any) {
          console.warn('[Upload] Failed to delete temp file:', e.message);
        }
      }, 500);
      
      // 返回访问 URL
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      return `${baseUrl}/api/images/received/${finalFilename}`;
    };

    // 保存临时图片
    const backTemp = await saveTempImage(backImage);
    let frontTemp: {tmpPath: string, originalName: string} | undefined;
    if (frontImage) {
      if (!allowedTypes.includes(frontImage.type)) {
        // 清理已保存的临时文件
        fs.unlinkSync(backTemp.tmpPath);
        return NextResponse.json(
          { error: '不支持的文件格式，请上传 JPG/PNG/HEIC/WEBP 格式' },
          { status: 400 }
        );
      }
      frontTemp = await saveTempImage(frontImage);
    }

    let ocrResult: any = null;
    let ocrError = false;
    let ocrErrorMessage = '';

    try {
      const arrayBuffer = await backImage.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      console.log('[OCR] 开始识别图片', {
        userId,
        imageSize: base64.length,
      });
      ocrResult = await recognizePostcard(base64);
      console.log('[OCR] 识别成功', {
        postcardId: ocrResult?.postcardId,
        postcardIdConfidence: ocrResult?.postcardIdConfidence,
        confidence: ocrResult?.confidence,
      });
    } catch (error: any) {
      console.error('[OCR] 识别失败:', {
        userId,
        error: error.message,
        stack: error.stack?.substring(0, 500),
      });
      ocrError = true;
      ocrErrorMessage = error.message;
    }

    // 检测是否重复（收信专用函数）
    if (ocrResult?.postcardId) {
      const duplicate = await checkDuplicateReceivedCard(ocrResult.postcardId, userId);
      
      if (duplicate.exists && duplicate.receivedCard) {
        // 发现重复，清理临时文件
        fs.unlinkSync(backTemp.tmpPath);
        if (frontTemp) fs.unlinkSync(frontTemp.tmpPath);
        
        // 返回提示
        return NextResponse.json({
          error: 'DUPLICATE_POSTCARD_ID',
          message: `该明信片 ID (${ocrResult.postcardId}) 已存在于历史记录中`,
          duplicateCardId: duplicate.receivedCard.id,
          duplicateInfo: {
            postcardId: duplicate.receivedCard.postcardId,
            createdAt: duplicate.receivedCard.createdAt,
            formattedTime: duplicate.receivedCard.formattedTime,
            country: duplicate.receivedCard.country,
            city: duplicate.receivedCard.city,
          },
          action: 'overwrite',
        }, { status: 409 }); // 409 Conflict
      }
    }

    // OCR 完成后，将临时文件移动到最终位置（以 postcardId 命名）
    let backImageUrl: string;
    let frontImageUrl: string | undefined;
    
    try {
      backImageUrl = await moveToFinalPath(backTemp.tmpPath, ocrResult?.postcardId);
      if (frontTemp) {
        frontImageUrl = await moveToFinalPath(frontTemp.tmpPath, ocrResult?.postcardId, '-front');
      }
    } catch (moveError: any) {
      // 移动失败，清理临时文件
      fs.unlinkSync(backTemp.tmpPath);
      if (frontTemp) fs.unlinkSync(frontTemp.tmpPath);
      throw new Error(`图片保存失败: ${moveError.message}`);
    }
    
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
        metadata: ocrResult ? JSON.stringify({
          senderUsername: ocrResult?.senderUsername,
          detectedLang: ocrResult?.detectedLanguage,
          ocrConfidence: ocrResult?.confidence,
          translatedText: ocrResult?.translatedText,
          frontImageUrl,
          isPublic,
          receivedAt,
        }) : null,
      },
    });
    
    // console.log('[API] Created received card:', receivedCard.id);

    // 解析 metadata
    let metadata: any = {};
    try {
      metadata = receivedCard.metadata ? JSON.parse(receivedCard.metadata) : {};
    } catch (e) {
      metadata = {};
    }

    const responseData = {
      id: receivedCard.id,
      postcardId: receivedCard.postcardId,
      senderUsername: metadata.senderUsername,
      senderCountry: receivedCard.country,
      senderCity: receivedCard.city,
      handwrittenText: receivedCard.ocrText,
      translatedText: metadata.translatedText,
      detectedLang: metadata.detectedLang,
      ocrConfidence: metadata.ocrConfidence,
      backImageUrl: receivedCard.imageUrl,
      originalImageUrl: receivedCard.originalImageUrl,
      frontImageUrl: metadata.frontImageUrl,
      isOcrManualEdit: false,
      createdAt: receivedCard.createdAt,
    };

    // 异步触发图片自动增强（不阻塞响应）
    // 注意：这里不等待处理完成，直接返回响应
    const cardId = receivedCard.id;
    const currentUserId = userId; // 保存 userId 到闭包
    
    // 使用 setImmediate 在响应后异步处理
    setImmediate(async () => {
      try {
        // 直接调用服务函数，只传 cardId，服务层自行查询图片路径
        await autoEnhanceImage(cardId, currentUserId);
        
        console.log('[AutoEnhance] Triggered for card:', cardId);
      } catch (error: any) {
        console.error('[AutoEnhance] Failed to trigger:', error);
        // 不影响主流程，只记录日志
      }
    });

    return NextResponse.json(responseData, { status: 200 });
  } catch (error: any) {
    // console.error('[API] Error creating received card:', error);
    // console.error('[API] Error message:', error.message);
    // console.error('[API] Error code:', error.code);
    // console.error('[API] Error meta:', error.meta);

    return NextResponse.json({
      error: '创建收信记录失败',
      details: error.message,
      code: error.code 
    }, { status: 500 });
  }
}
