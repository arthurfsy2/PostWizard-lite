/**
 * 重复检测辅助函数
 * 
 * 统一检测明信片是否已存在（所有 Step 1 来源共用）
 * - 邮件粘贴
 * - 邮箱关联（IMAP）
 * - Postcrossing 直连
 */

import { prisma } from '@/lib/prisma';

function sanitizeStoredRecipientAddress(address?: string | null): string {
  const raw = (address || '').trim();
  if (!raw) return '';

  let sanitized = raw;

  sanitized = sanitized.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '');
  sanitized = sanitized.replace(/https?:\/\/\S+/gi, '');
  sanitized = sanitized.replace(/www\.\S+/gi, '');
  sanitized = sanitized.replace(/\+?\d[\d\s().-]{6,}\d/g, '');
  sanitized = sanitized.replace(/postcrossing[^\s,;，；]*/gi, '');
  sanitized = sanitized.replace(/profile[^\n,;，；]*/gi, '');

  const lines = sanitized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      if (/address\s*:/i.test(line)) return false;
      if (/^(street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|drive|dr\.?|boulevard|blvd\.?|building|room|apartment|apt\.?|floor|fl\.?|district|province|postal code|zip code|postcode)\b/i.test(line)) return false;
      if (/[\u4e00-\u9fa5].*(地址|街道|邮编|路|号|室|楼|区)/.test(line)) return false;
      if (/^\d{4,}\s+[A-Za-z\u4e00-\u9fa5-]+/.test(line)) return false;
      return true;
    });

  sanitized = lines.join(', ');
  sanitized = sanitized.replace(/\s{2,}/g, ' ');
  sanitized = sanitized.replace(/\s*[,;，；]\s*/g, ', ');
  sanitized = sanitized.replace(/(?:,\s*){2,}/g, ', ');
  sanitized = sanitized.replace(/^[,;，；\s]+|[,;，；\s]+$/g, '');

  return sanitized;
}


/**
 * 检查寄出的明信片是否已存在
 * 
 * @param postcardId - 明信片 ID
 * @param userId - 用户 ID
 * @returns 已存在的明信片记录（如果存在）
 */
export async function checkDuplicatePostcard(
  postcardId: string,
  userId: string
): Promise<{
  exists: boolean;
  postcard?: {
    id: string;
    postcardId: string;
    recipientName: string;
    createdAt: Date;
    formattedTime: string;
  };
}> {
  const existingPostcard = await prisma.postcard.findFirst({
    where: {
      postcardId,
      userId,
    },
  });

  if (existingPostcard) {
    return {
      exists: true,
      postcard: {
        id: existingPostcard.id,
        postcardId: existingPostcard.postcardId,
        recipientName: existingPostcard.recipientName,
        createdAt: existingPostcard.createdAt,
        formattedTime: existingPostcard.createdAt.toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
    };
  }

  return {
    exists: false,
  };
}

/**
 * 检查收信记录是否已存在（收信功能专用）
 * 
 * @param postcardId - 明信片 ID
 * @param userId - 用户 ID
 * @returns 已存在的收信记录（如果存在）
 */
export async function checkDuplicateReceivedCard(
  postcardId: string,
  userId: string
): Promise<{
  exists: boolean;
  receivedCard?: {
    id: string;
    postcardId: string;
    country: string | null;
    city: string | null;
    createdAt: Date;
    formattedTime: string;
  };
}> {
  const existingReceivedCard = await prisma.receivedCard.findFirst({
    where: {
      postcardId,
      userId,
    },
  });

  if (existingReceivedCard) {
    return {
      exists: true,
      receivedCard: {
        id: existingReceivedCard.id,
        postcardId: existingReceivedCard.postcardId,
        country: existingReceivedCard.country,
        city: existingReceivedCard.city,
        createdAt: existingReceivedCard.createdAt,
        formattedTime: existingReceivedCard.createdAt.toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
    };
  }

  return {
    exists: false,
  };
}

/**
 * 保存或更新明信片记录
 * 
 * @param userId - 用户 ID
 * @param postcardId - 明信片 ID
 * @param parsedInfo - AI 解析结果
 * @returns 保存后的明信片记录
 */
export async function saveOrUpdatePostcard(
  userId: string,
  postcardId: string,
  parsedInfo: any
) {
  const sanitizedAddress = sanitizeStoredRecipientAddress(parsedInfo.address);

  // 检查是否已存在
  const duplicate = await checkDuplicatePostcard(postcardId, userId);

  if (duplicate.exists && duplicate.postcard) {
    // 已存在，更新记录
    const updated = await prisma.postcard.update({
      where: { id: duplicate.postcard.id },
      data: {
        recipientName: parsedInfo.name,
        recipientCountry: parsedInfo.country,
        recipientCity: parsedInfo.city,
        recipientAddress: sanitizedAddress,
        recipientAge: parsedInfo.age,
        recipientGender: parsedInfo.gender,
        recipientInterests: parsedInfo.interests?.join(', ') || '',
        recipientBio: parsedInfo.messageToSender || '',
        distance: parsedInfo.distance || 0,
        status: 'pending',
      },
    });

    return {
      postcard: updated,
      isDuplicate: true,
      duplicateInfo: {
        postcardId,
        createdAt: duplicate.postcard.createdAt,
        formattedTime: duplicate.postcard.formattedTime,
      },
      sanitizedAddress,
    };
  } else {
    // 不存在，创建新记录
    const created = await prisma.postcard.create({
      data: {
        userId,
        postcardId,
        recipientName: parsedInfo.name,
        recipientCountry: parsedInfo.country,
        recipientCity: parsedInfo.city,
        recipientAddress: sanitizedAddress,
        recipientAge: parsedInfo.age,
        recipientGender: parsedInfo.gender,
        recipientInterests: parsedInfo.interests?.join(', ') || '',
        recipientBio: parsedInfo.messageToSender || '',
        distance: parsedInfo.distance || 0,
        status: 'pending',
      },
    });

    return {
      postcard: created,
      isDuplicate: false,
      sanitizedAddress,
    };
  }
}


/**
 * 构建统一的返回结果
 * 
 * @param postcard - 明信片记录
 * @param isDuplicate - 是否重复
 * @param duplicateInfo - 重复信息
 * @param parsedInfo - AI 解析结果
 * @returns 统一的 API 响应数据
 */
export function buildResponseData(
  postcard: any,
  isDuplicate: boolean,
  duplicateInfo: any,
  parsedInfo: any,
  sanitizedAddress?: string
) {
  return {
    success: true,
    data: {
      id: postcard.id,
      name: postcard.recipientName || parsedInfo.name,
      country: postcard.recipientCountry || parsedInfo.country,
      city: postcard.recipientCity || parsedInfo.city,
      address: sanitizedAddress ?? (postcard.recipientAddress || parsedInfo.address || ''),
      postcardId: postcard.postcardId,
      distance: postcard.distance || parsedInfo.distance,
      interests: parsedInfo.interests || [],
      dislikes: parsedInfo.dislikes || [],
      messageToSender: parsedInfo.messageToSender || '',
      cardPreference: parsedInfo.cardPreference || 'any',
      contentPreference: parsedInfo.contentPreference || '',
      languagePreference: parsedInfo.languagePreference || '',
      specialRequests: parsedInfo.specialRequests || 'none',
      source: 'imap_email',
      hasMaterials: parsedInfo.hasMaterials || false,
      filledMaterialsCategories: parsedInfo.filledMaterialsCategories || [],
    },
    isDuplicate,
    duplicateInfo: isDuplicate
      ? {
          postcardId: duplicateInfo.postcardId,
          createdAt: duplicateInfo.createdAt,
          formattedTime: duplicateInfo.formattedTime,
        }
      : undefined,
  };
}

