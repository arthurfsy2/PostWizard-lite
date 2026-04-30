import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLocalUserId } from '@/lib/local-user';
import { parsePastedEmail } from '@/lib/services/aiParserService';
import { sanitizeRecipientInput } from '@/lib/sanitize-recipient-input';
import { saveOrUpdatePostcard, buildResponseData } from '@/lib/helpers/duplicateChecker';

/**
 * POST /api/content/paste
 * 用户粘贴邮件 API（全量 AI 解析）
 * 
 * 接收用户粘贴的 Postcrossing 邮件文本，使用 AI 解析收件人信息
 * 
 * Request body:
 * - content: 邮件全文（必填）
 * 
 * Response:
 * - success: boolean
 * - data: {
 *     name: string,
 *     country: string,
 *     city: string,
 *     address: string,
 *     postcardId: string,
 *     interests: string[],
 *     bio: string,
 *   }
 */
export async function POST(request: NextRequest) {
  try {
    // 验证用户登录状态
    const userId = getLocalUserId();

    // 开源版：跳过额度检查

    const body = await request.json();
    const { content: emailContent } = body;

    // 验证必填参数
    if (!emailContent || typeof emailContent !== 'string') {
      return NextResponse.json(
        { 
          success: false, 
          error: '缺少必填参数：content（邮件内容）' 
        },
        { status: 400 }
      );
    }

    const sanitization = sanitizeRecipientInput(emailContent);

    // 使用 AI 解析邮件内容（先规则脱敏，再走统一服务）
    const parsedInfo = await parsePastedEmail(sanitization.sanitizedText);

    // 如果 AI 解析失败，尝试用正则提取 ID 作为后备
    let postcardId: string | undefined = parsedInfo.postcardId;
    if (!postcardId) {
      const extractedId = extractPostcardIdFromContent(sanitization.sanitizedText);
      postcardId = extractedId || undefined;
    }
    
    if (!postcardId) {
      return NextResponse.json(
        { 
          success: false, 
          error: '无法从邮件内容中提取明信片 ID。请确保邮件包含类似 "CN-123456" 格式的 ID。' 
        },
        { status: 400 }
      );
    }

    // 如果 AI 没有解析到其他信息，用低敏文本做本地后备补充
    const fallbackInfo = parsePastedEmailContent(sanitization.sanitizedText);

    const finalInfo = {
      name: parsedInfo.name || fallbackInfo.recipientName || 'Unknown',
      country: parsedInfo.country || fallbackInfo.recipientCountry || '',
      city: parsedInfo.city || fallbackInfo.recipientCity || '',
      address: parsedInfo.address || '',

      distance: parsedInfo.distance,
      interests: parsedInfo.interests || (fallbackInfo.recipientInterests ? fallbackInfo.recipientInterests.split(',').map(i => i.trim()) : []),
      dislikes: parsedInfo.dislikes || [],
      messageToSender: parsedInfo.messageToSender || '',
      bio: parsedInfo.messageToSender || fallbackInfo.recipientBio || '',
      age: parsedInfo.age || fallbackInfo.recipientAge,
      gender: parsedInfo.gender || fallbackInfo.recipientGender,
      cardsSent: parsedInfo.cardsSent,
      cardsReceived: parsedInfo.cardsReceived,
      languages: parsedInfo.languages || [],
      cardPreference: parsedInfo.cardPreference,
      contentPreference: parsedInfo.contentPreference,
      languagePreference: parsedInfo.languagePreference,
      specialRequests: parsedInfo.specialRequests,
    };

    // 使用统一的重复检测和保存逻辑
    const saveResult = await saveOrUpdatePostcard(
      userId,
      postcardId,
      finalInfo,
      'pasted_email'
    );

    // 创建粘贴记录（无论是否重复都创建）
    const pastedEmailRecord = await prisma.pastedEmail.create({
      data: {
        postcardId: saveResult.postcard.id,
        userId: userId,
        rawContent: sanitization.sanitizedText,
        parsedData: JSON.stringify(finalInfo),
      },
    });


    // 构建统一的返回结果
    const responseData = buildResponseData(
      saveResult.postcard,
      saveResult.isDuplicate,
      saveResult.duplicateInfo,
      finalInfo,
      saveResult.sanitizedAddress
    );


    return NextResponse.json({
      ...responseData,
    });
  } catch (error) {
    // console.error('Error processing pasted email with AI:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'AI 解析失败，请稍后重试',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/content/paste
 * 获取用户粘贴的邮件列表
 */
export async function GET(request: NextRequest) {
  try {
    // 验证用户登录状态
    const userId = getLocalUserId();

    const searchParams = request.nextUrl.searchParams;
    const postcardId = searchParams.get('postcardId');
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const where: any = { userId: userId }; // 只查询当前用户的记录
    if (postcardId) {
      where.postcard = { postcardId };
    }

    const pastedEmails = await prisma.pastedEmail.findMany({
      where,
      include: {
        postcard: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      data: pastedEmails.map(pe => ({
        id: pe.id,
        postcardId: pe.postcard?.postcardId || '',
        recipientName: pe.postcard?.recipientName || '',
        country: pe.postcard?.recipientCountry || '',
        city: pe.postcard?.recipientCity || '',
        parsedInfo: JSON.parse(pe.parsedData || '{}'),
        createdAt: pe.createdAt,
      })),
      total: pastedEmails.length,
    });
  } catch (error) {
    // console.error('Error fetching pasted emails:', error);
    return NextResponse.json(
      { success: false, error: '获取粘贴邮件列表失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/content/paste
 * 删除粘贴的邮件记录
 */
export async function DELETE(request: NextRequest) {
  try {
    // 验证用户登录状态
    const userId = getLocalUserId();

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少必填参数：id' },
        { status: 400 }
      );
    }

    // 验证记录属于当前用户
    const pastedEmail = await prisma.pastedEmail.findFirst({
      where: { id, userId: userId },
    });

    if (!pastedEmail) {
      return NextResponse.json(
        { success: false, error: '记录不存在或无权删除' },
        { status: 404 }
      );
    }

    await prisma.pastedEmail.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: '删除成功',
    });
  } catch (error) {
    // console.error('Error deleting pasted email:', error);
    return NextResponse.json(
      { success: false, error: '删除失败' },
      { status: 500 }
    );
  }
}

/**
 * 从邮件内容中提取明信片 ID（正则后备）
 */
function extractPostcardIdFromContent(content: string): string | null {
  const patterns = [
    /Postcrossing\s+(?:Postcard\s+)?ID[:\s]*([A-Z]{2}-\d{6,8})/i,
    /Postcard\s+ID[:\s]*([A-Z]{2}-\d{6,8})/i,
    /ID[:\s]*([A-Z]{2}-\d{6,8})/i,
    /([A-Z]{2}-\d{6,8})/i,
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1].toUpperCase();
    }
  }
  
  return null;
}

/**
 * 解析粘贴的邮件内容（正则后备）
 */
function parsePastedEmailContent(content: string): {
  recipientName?: string;
  recipientCountry?: string;
  recipientCity?: string;
  recipientAge?: number;
  recipientGender?: string;
  recipientInterests?: string;
  recipientBio?: string;
} {

  const result: any = {};

  // 解析姓名 - 支持多种格式
  const usernameMatch = content.match(/([A-Za-z0-9_]+)\s*\(\s*or\s+([A-Za-z]+)\s*\)/i);
  if (usernameMatch) {
    result.recipientName = usernameMatch[2];
  }
  
  if (!result.recipientName) {
    const namePatterns = [
      /(?:name|姓名|收件人|My name is|I'm|I am)[:：\s]*([A-Za-z]+)/i,
    ];
    
    for (const pattern of namePatterns) {
      const match = content.match(pattern);
      if (match) {
        result.recipientName = match[1].trim();
        break;
      }
    }
  }

  // 解析国家
  const inCountryMatch = content.match(/,?\s*in\s+([A-Za-z]+)/i);
  if (inCountryMatch) {
    let country = inCountryMatch[1].trim();
    const regionMap: Record<string, string> = {
      'taiwan': 'Taiwan, China',
      'hongkong': 'Hong Kong, China',
      'hong kong': 'Hong Kong, China',
      'macau': 'Macau, China',
      'macao': 'Macau, China',
    };
    const countryLower = country.toLowerCase();
    result.recipientCountry = regionMap[countryLower] || country;
  }
  
  if (!result.recipientCountry) {
    const countryPatterns = [
      /in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),?\s*([A-Z][a-z]+)\s+away!/i,
      /(?:country|国家|Location)[:：\s]*([^\n\r,]+)/i,
      /lives?\s+in\s+([^\n\r,]+)/i,
    ];

    const regionMap: Record<string, string> = {
      'taiwan': 'Taiwan, China',
      'hongkong': 'Hong Kong, China',
      'hong kong': 'Hong Kong, China',
      'macau': 'Macau, China',
      'macao': 'Macau, China',
    };

    for (const pattern of countryPatterns) {
      const match = content.match(pattern);
      if (match) {
        let country = match[1].trim();
        const countryLower = country.toLowerCase();
        result.recipientCountry = regionMap[countryLower] || country;
        break;
      }
    }
  }

  // 解析城市
  const cityPatterns = [
    /(?:in|Taiwan|[\u4e00-\u9fa5]+[市县区])\s*,?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*(?:\d|km|America)/i,
    /(?:city|城市)[:：\s]*([^\n\r,]+)/i,
    /(?:City|City\s+300\d+)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
  ];
  
  for (const pattern of cityPatterns) {
    const match = content.match(pattern);
    if (match) {
      const city = match[1].trim();
      if (city && city.length > 2 && !city.match(/^\d+$/)) {
        result.recipientCity = city;
        break;
      }
    }
  }



  // 解析年龄
  const ageMatch = content.match(/born\s+on\s+\d+\/([A-Za-z]+)\/(\d{4})/i);
  if (ageMatch) {
    result.recipientAge = 2026 - parseInt(ageMatch[2], 10);
  }

  // 解析性别
  const genderMatch = content.match(/\(he\/him\)|\(she\/her\)|\(they\/them\)/i);
  if (genderMatch) {
    result.recipientGender = genderMatch[0].replace(/[()]/g, '').split('/')[0];
  }

  // 解析兴趣和 Bio
  const aboutMatch = content.match(/About(?:\s+the\s+recipient)?[:：\s]*[""]?([^"\n]+)[""]?/i);
  if (aboutMatch) {
    result.recipientBio = aboutMatch[1].trim();
    
    const interestKeywords = ['coffee', 'tea', 'books', 'music', 'art', 'painting', 'rocks', 'hiking', 'travel', 'cooking', 'photography', 'gardening', 'pets', 'dogs', 'cats'];
    const foundInterests: string[] = [];
    const bioLower = result.recipientBio.toLowerCase();
    
    for (const keyword of interestKeywords) {
      if (bioLower.includes(keyword)) {
        foundInterests.push(keyword);
      }
    }
    
    if (foundInterests.length > 0) {
      result.recipientInterests = foundInterests.join(', ');
    }
  }

  return result;
}
