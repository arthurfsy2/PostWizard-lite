import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { prisma } from '../prisma';

export interface ImageProcessingOptions {
  rotation?: number; // 旋转角度（0/90/180/270）
  cropRect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  corners?: Array<{ x: number; y: number }>; // 四角坐标（预留）
  enhance?: boolean; // 是否增强（锐化/对比度）
  quality?: number; // WebP 质量（默认 85）
  maxWidth?: number; // 最大宽度（默认 1800）
}

export interface ImageProcessingResult {
  processedImageUrl: string;
  originalWidth: number;
  originalHeight: number;
  processedWidth: number;
  processedHeight: number;
  rotation: number;
  quality: number;
}

/**
 * 处理图片（旋转/裁剪/增强/压缩）
 */
export async function processImage(
  originalImagePath: string,
  cardId: string,
  userId: string,
  options: ImageProcessingOptions = {}
): Promise<ImageProcessingResult> {
  const {
    rotation = 0,
    cropRect,
    enhance = true,
    quality = 85,
    maxWidth = 1800,
  } = options;

  try {
    // 读取原图获取尺寸
    const originalMetadata = await sharp(originalImagePath).metadata();
    const originalWidth = originalMetadata.width || 0;
    const originalHeight = originalMetadata.height || 0;

    let pipeline = sharp(originalImagePath);

    // 1. 旋转
    if (rotation > 0) {
      const rotateAngle = rotation % 360;
      if (rotateAngle === 90 || rotateAngle === 180 || rotateAngle === 270) {
        pipeline = pipeline.rotate(rotateAngle);
      }
    }

    // 2. 裁剪（矩形裁剪）
    if (cropRect) {
      pipeline = pipeline.extract({
        left: cropRect.x,
        top: cropRect.y,
        width: cropRect.width,
        height: cropRect.height,
      });
    }

    // 3. 调整尺寸（限制最大宽度）
    const currentMetadata = await pipeline.metadata();
    const currentWidth = currentMetadata.width || 0;
    if (currentWidth > maxWidth) {
      pipeline = pipeline.resize(maxWidth, undefined, {
        withoutEnlargement: true,
        fit: 'inside',
      });
    }

    // 4. 增强（锐化 + 对比度）
    if (enhance) {
      pipeline = pipeline
        .sharpen({ sigma: 1.5, m1: 0.5, m2: 0.5 })
        .modulate({
          brightness: 1.05,
          contrast: 1.1,
          saturation: 1.05,
        });
    }

    // 5. 输出 WebP
    const outputDir = path.join(process.cwd(), 'data', 'received');

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputFilename = `${cardId}-processed-${Date.now()}.webp`;
    const outputPath = path.join(outputDir, outputFilename);

    await pipeline.webp({ quality }).toFile(outputPath);

    // 获取处理后尺寸
    const processedMetadata = await sharp(outputPath).metadata();
    const processedWidth = processedMetadata.width || 0;
    const processedHeight = processedMetadata.height || 0;

    // 生成访问 URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const processedImageUrl = `${baseUrl}/api/images/received/${outputFilename}`;

    return {
      processedImageUrl,
      originalWidth,
      originalHeight,
      processedWidth,
      processedHeight,
      rotation,
      quality,
    };
  } catch (error: any) {
    console.error('[ImageProcessing] Error processing image:', error);
    throw new Error(`图片处理失败：${error.message}`);
  }
}

/**
 * 自动优化图片（默认增强，无裁剪）
 * @param cardId - 明信片记录 ID
 * @param userId - 用户 ID
 */
export async function autoEnhanceImage(
  cardId: string,
  userId: string
): Promise<ImageProcessingResult> {
  // 查询数据库获取原图路径
  const receivedCard = await prisma.receivedCard.findUnique({
    where: { id: cardId },
    select: { originalImageUrl: true },
  });
  
  if (!receivedCard?.originalImageUrl) {
    throw new Error('未找到原始图片路径');
  }
  
  // 将 URL 转换为本地文件路径
  const url = receivedCard.originalImageUrl;
  let originalImagePath: string;
  
  if (url.includes('/api/images/received/')) {
    // 新的图片服务路径: /api/images/received/{filename} -> data/received/{filename}
    const filename = url.split('/api/images/received/').pop();
    if (!filename) {
      throw new Error('无法从 URL 提取文件名');
    }
    originalImagePath = path.join(process.cwd(), 'data', 'received', filename);
  } else if (url.startsWith('http://localhost:3000/')) {
    // 兼容旧路径（临时）
    const relativePath = url.replace('http://localhost:3000/', '');
    originalImagePath = path.join(process.cwd(), 'public', relativePath);
  } else if (url.startsWith('/')) {
    // 相对路径
    originalImagePath = path.join(process.cwd(), 'public', url);
  } else {
    // 其他情况直接使用
    originalImagePath = url;
  }
  
  return processImage(originalImagePath, cardId, userId, {
    enhance: true,
    quality: 85,
    maxWidth: 1800,
  });
}

/**
 * 更新数据库记录
 */
export async function updateCardImageStatus(
  cardId: string,
  processedImageUrl: string,
  status: 'completed' | 'failed',
  error?: string,
  adjustmentMeta?: any
): Promise<void> {
  try {
    const updateData: any = {
      processedImageUrl,
      imageProcessingStatus: status,
      imageAdjustedAt: new Date(),
      imageProcessVersion: { increment: 1 },
    };

    if (error) {
      updateData.imageProcessingError = error;
    }

    if (adjustmentMeta) {
      updateData.adjustmentMeta = JSON.stringify(adjustmentMeta);
    }

    await prisma.receivedCard.update({
      where: { id: cardId },
      data: updateData,
    });
  } catch (error: any) {
    console.error('[ImageProcessing] Error updating database:', error);
    throw new Error(`更新图片状态失败：${error.message}`);
  }
}

/**
 * 从 URL 获取本地文件路径（兼容 Vercel 和本地）
 */
export function getLocalImagePath(imageUrl: string): string {
  // 如果是相对路径或本地 URL，转换为绝对路径
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  // 情况 1: 相对路径 /uploads/...
  if (imageUrl.startsWith('/uploads/')) {
    return path.join(process.cwd(), 'public', imageUrl);
  }
  
  // 情况 2: 完整 URL http://localhost:3000/uploads/...
  if (imageUrl.startsWith(baseUrl)) {
    const relativePath = imageUrl.substring(baseUrl.length);
    return path.join(process.cwd(), 'public', relativePath);
  }
  
  // 情况 3: Vercel API URL (http://xxx/api/uploads/...)
  if (imageUrl.includes('/api/uploads/')) {
    const match = imageUrl.match(/\/api\/uploads\/(.*)/);
    if (match) {
      const relativePath = `/uploads/${match[1]}`;
      return path.join(process.cwd(), 'public', relativePath);
    }
  }
  
  // 情况 4: 已经是文件路径，直接返回
  return imageUrl;
}
