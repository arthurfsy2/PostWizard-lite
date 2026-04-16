/**
 * Traveling Postcard 详情解析服务
 * 
 * 解析 Postcrossing travelingpostcard 页面 HTML，提取结构化信息
 * 格式与 /api/content/paste 保持一致
 */

/**
 * 解析结果类型（与 paste API 保持一致）
 */
export interface ParsedRecipientInfo {
  name: string;
  country: string;
  city: string;
  postcardId: string;
  distance?: number;
  interests: string[];
  dislikes: string[];
  messageToSender: string;
  cardPreference: string;
  contentPreference: string;
  languagePreference: string;
  specialRequests: string;
  // 额外字段
  pronouns?: string;
  receiverUsername?: string;
  aboutText?: string;
  languages?: string;
  addressImageUrl?: string;
}

/**
 * 从 travelingpostcard 页面 HTML 解析收件人信息
 * 
 * @param html - 页面 HTML 内容
 * @param postcardId - 明信片 ID
 * @returns 结构化的收件人信息
 */
export function parseTravelingPostcardHTML(
  html: string,
  postcardId: string
): ParsedRecipientInfo {
  // 1. 提取收件人姓名 + 代词
  let name = 'Unknown';
  let pronouns: string | undefined;
  
  const nameMatch = html.match(/<h2[^>]*class="name-username"[^>]*>([\s\S]*?)<\/h2>/i);
  if (nameMatch) {
    const nameHtml = nameMatch[1];
    // 提取名字（第一个文本节点）
    const nameTextMatch = nameHtml.match(/^([\w\s]+)\s*</);
    if (nameTextMatch) {
      name = nameTextMatch[1].trim();
    }
    
    // 提取代词 (she/her, he/him 等)
    const pronounsMatch = nameHtml.match(/\(([^)]+)\)/);
    if (pronounsMatch) {
      pronouns = pronounsMatch[1].trim();
    }
  }

  // 2. 提取国家
  let country = '';
  const countryMatch = html.match(/<a[^>]*href="\/country\/[^"]*"[^>]*>([^<]+)<\/a>/);
  if (countryMatch) {
    country = countryMatch[1].trim();
  }

  // 3. 提取城市（从 "Lives in" 或 "From"）
  let city = '';
  const cityMatch = html.match(/Lives in[^>]*>[^<]*<[^>]*>([^<,]+),?/);
  if (cityMatch) {
    city = cityMatch[1].trim();
  }
  
  // 备选：从 "From" 提取
  if (!city) {
    const fromMatch = html.match(/From:[^>]*>[^<]*<[^>]*>([^<,]+),?/);
    if (fromMatch) {
      city = fromMatch[1].trim();
    }
  }

  // 4. 提取距离
  let distance: number | undefined;
  const distanceMatch = html.match(/Distance:[^>]*>[^<]*<[^>]*>([\d,]+)\s*(km|miles)/i);
  if (distanceMatch) {
    const distanceValue = parseFloat(distanceMatch[1].replace(/,/g, ''));
    const unit = distanceMatch[2].toLowerCase();
    // 如果是英里，转换为公里
    distance = unit === 'miles' ? distanceValue * 1.60934 : distanceValue;
  }

  // 5. 提取个人简介（about text）
  let aboutText = '';
  const aboutSectionMatch = html.match(/<div[^>]*class="[^"]*profile[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (aboutSectionMatch) {
    aboutText = aboutSectionMatch[1]
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .trim();
  }

  // 6. 提取语言信息
  let languages: string | undefined;
  const langMatch = html.match(/Languages?:[^>]*>[^<]*<[^>]*>([^<]+)/i);
  if (langMatch) {
    languages = langMatch[1].trim();
  }

  // 7. 从 aboutText 中提取结构化 interests
  const interests: string[] = [];
  if (aboutText) {
    const interestKeywords = [
      'ice hockey', 'motorsports', 'animals', 'music', 'movies', 
      'videogames', 'books', 'travel', 'collecting', 'sports',
      'moomins', 'star wars', 'disney', 'hello kitty', 'philosophy',
      'crocheting', 'plants', 'reading', 'art', 'fashion'
    ];
    
    const foundInterests = new Set<string>();
    interestKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\w*\\b`, 'i');
      if (regex.test(aboutText)) {
        foundInterests.add(keyword);
      }
    });
    
    if (foundInterests.size > 0) {
      interests.push(...Array.from(foundInterests));
    }
  }

  // 8. 提取 dislikes
  const dislikes: string[] = [];
  if (aboutText) {
    const dislikeMatch = aboutText.match(/(?:dislike|hate|not like|don't like|don't want)[:\s]+([^.\n]+)/i);
    if (dislikeMatch) {
      const dislikeText = dislikeMatch[1];
      // 简单拆分
      const items = dislikeText.split(/[,;]/).map(s => s.trim()).filter(Boolean);
      if (items.length > 0) {
        dislikes.push(...items);
      }
    }
  }

  // 9. 提取 messageToSender（直接对发送者的话）
  let messageToSender = '';
  const messageMatch = aboutText.match(/(?:write to me|tell me|message me|for sender)[:\s]+([^.\n]+)/i);
  if (messageMatch) {
    messageToSender = messageMatch[1].trim();
  }

  // 10. 提取卡片偏好
  let cardPreference = 'any';
  const cardPrefMatch = aboutText.match(/(?:card preference|prefer cards|like cards)[:\s]+([^.\n]+)/i);
  if (cardPrefMatch) {
    cardPreference = cardPrefMatch[1].trim();
  }

  // 11. 提取内容偏好
  let contentPreference = '';
  const contentPrefMatch = aboutText.match(/(?:content preference|prefer writing|like reading)[:\s]+([^.\n]+)/i);
  if (contentPrefMatch) {
    contentPreference = contentPrefMatch[1].trim();
  }

  // 12. 提取语言偏好
  let languagePreference = '';
  const langPrefMatch = aboutText.match(/(?:language preference|write in|prefer language)[:\s]+([^.\n]+)/i);
  if (langPrefMatch) {
    languagePreference = langPrefMatch[1].trim();
  }

  // 13. 提取特殊要求
  let specialRequests = 'none';
  if (aboutText) {
    const specialMatch = aboutText.match(/I'd love to get(.*?)(?:\.|If|$)/is);
    if (specialMatch) {
      const specialText = specialMatch[1].trim();
      if (specialText.length > 0) {
        specialRequests = specialText;
      }
    }
  }

  // 返回与 paste API 一致的格式
  return {
    name,
    country,
    city,
    postcardId,
    distance,
    interests,
    dislikes,
    messageToSender,
    cardPreference,
    contentPreference,
    languagePreference,
    specialRequests,
    // 额外字段
    pronouns,
    aboutText,
    languages,
  };
}

