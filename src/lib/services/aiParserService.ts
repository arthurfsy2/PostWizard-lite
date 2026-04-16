/**
 * AI 解析共享服务
 * 
 * 统一的 AI 解析接口，支持多种来源的 Postcrossing 内容解析
 * - 邮件粘贴（用户手动粘贴）
 * - 邮箱关联（IMAP 获取的原始邮件）
 * - Postcrossing 直连（traveling 页面解析）
 */

import OpenAI from 'openai';
import { hasFilledMaterials, type MaterialCategory } from '@/lib/helpers/materialsChecker';

import { getAIConfigFromDB, createOpenAIClient } from './ai-config';

/**
 * 内容来源类型
 */
export type ContentSource = 'pasted_email' | 'imap_email' | 'postcrossing_profile';

/**
 * AI 解析结果类型（与数据库 Postcard 表字段对齐）
 */
export interface AIParsedResult {
  // 基本信息
  name: string;
  country: string;
  city: string;
  address?: string;
  postcardId: string;
  distance?: number;
  
  // 结构化偏好
  interests: string[];
  dislikes: string[];
  messageToSender: string;
  cardPreference: string;
  contentPreference: string;
  languagePreference: string;
  specialRequests: string;
  
  // 额外字段（根据来源不同可能包含）
  age?: number;
  gender?: string;
  cardsSent?: number;
  cardsReceived?: number;
  languages?: string[];
  
  // 来源信息
  source: ContentSource;
  profileRaw?: string; // 原始简介文本
  
  // 素材检查（Step 1 通用）
  hasMaterials: boolean; // 是否已填写个人素材
  filledMaterialsCategories: MaterialCategory[]; // 已填写的素材分类
}

/**
 * 解析配置
 */
export interface ParseConfig {
  source: ContentSource;
  extraInfo?: {
    receiverUsername?: string;
    postcardId?: string;
    emailSubject?: string;
    emailFrom?: string;
  };
}

/**
 * 构建系统提示词（根据来源类型）
 */
function buildSystemPrompt(source: ContentSource): string {
  const shouldMinimizeAddress = source === 'imap_email' || source === 'pasted_email';
  const addressInstruction = shouldMinimizeAddress
    ? '- **address 字段：对于邮件来源（IMAP / 粘贴邮件），不要提取详细门牌、街道、邮编、邮箱、电话、Profile 链接等敏感信息；只在确有必要时保留国家 / 城市这类低敏摘要，其余一律留空字符串。**'
    : '- **address 字段：提取完整的收件人地址（姓名 + 街道 + 城市 + 邮编 + 国家），如果邮件中有详细地址信息，必须提取！**';


  const basePrompt = `你是一个 Postcrossing 信息解析助手。请从以下内容中提取结构化的收件人信息。

请严格按照以下 JSON 格式返回（只返回 JSON，不要其他内容）：
{
  "name": "收件人姓名",
  "country": "Austria",
  "city": "城市名",
  "address": "完整地址（姓名 + 街道 + 城市 + 邮编 + 国家）",
  "postcardId": "CN-1234567",
  "distance": 8500,
  "languages": ["语言 1", "语言 2", "语言 3"],
  "interests": ["兴趣 1 | 中文翻译", "兴趣 2 | 中文翻译"],
  "dislikes": ["不喜欢的内容 | 中文翻译"],
  "messageToSender": "用户想说的话 | 中文翻译",
  "cardPreference": "any | 任何类型",
  "contentPreference": "general topics | 一般话题",
  "languagePreference": "English | 英语",
  "specialRequests": "特殊要求 | 中文翻译"
}

重要提醒：
${addressInstruction}
- **languages 字段：提取用户会说的所有语言（在 "Languages:" 后面），返回字符串数组，如 ["German", "English", "Finnish (in learning state)", "Italian (a little)"]**
- **interests 字段：请完整提取用户在简介中提到的所有兴趣爱好、喜欢的主题、收藏偏好等，不要遗漏！保留原文 + 中文翻译，用 | 分隔。例如用户提到 "ice hockey, motorsports, animals, music, videogames, movies, collecting pins..." 应该全部列出。**
- **cardsSent/cardsReceived：如果邮件中提到 "X postcards sent, Y received"，请提取这两个数字**
- **postcardId 字段：如果提示词中已提供明信片 ID（如 "明信片 ID：CN-1234567"），必须直接使用该值，不要从邮件内容中重新提取！**
- dislikes 字段：提取用户不喜欢的内容，如果没有则返回 []
- **messageToSender：用户想对发送者说的话，用一句话概括（100 字以内），使用 "{英文} | {中文}" 格式**
- cardPreference：明信片偏好，使用 "{英文} | {中文}" 格式（如 "any | 任何类型"）
- contentPreference：内容偏好，使用 "{英文} | {中文}" 格式（如 "general topics | 一般话题"）
- languagePreference：语言偏好，使用 "{英文} | {中文}" 格式（如 "English | 英语"）
- specialRequests：特殊要求，使用 "{英文} | {中文}" 格式（如 "none | 无"）
- country 使用国际通用描述（台湾 = 中国台湾，香港 = 中国香港）
- **如果某些信息无法提取，country 和 city 字段使用空字符串 ""（不要用 "undefined" 字符串）**`;

  switch (source) {
    case 'pasted_email':
      return basePrompt + `

邮件格式说明（粘贴邮件）：
- 明信片 ID：在第一行或 "Postcard ID:" 后面
- 发送者名字（name）：在 "And your postcard... will go to..." 后面
- **地址（address）：不要提取完整门牌、街道、邮编、邮箱、电话、Profile 链接等敏感信息；如确有必要，只保留国家 / 城市这类低敏摘要，否则留空字符串**
- 国家（country）：发送者所在国家

- 城市（city）：发送者所在城市
- 距离（distance）：格式如 "7,786 km away" 中的数字（只返回数字，如 7786）
- 出生日期：在 "born on" 后面，计算年龄
- **发送/接收数量（cardsSent/cardsReceived）：如 "435 postcards sent, 433 received"，提取这两个数字**
- **语言（languages）：在 "Languages:" 后面，提取所有语言，返回数组格式，如 ["German", "English", "Finnish (in learning state)"]**
- 收片偏好（interests）：在 "About the recipient:" 之后到结束或 "NO!" 之前的内容。**请仔细提取用户提到的每一个兴趣爱好，包括运动、收藏、娱乐、旅行等各方面，不要遗漏！**
- 收片厌恶（dislikes）：在 "NO!NO! THESE POSTCARDS are-" 或类似表述之后的内容`;

    case 'imap_email':
      return basePrompt + `

邮件格式说明（IMAP 原始邮件）：
- 这是从用户邮箱中获取的原始 Postcrossing 邮件
- 邮件可能包含 HTML 格式，需要提取纯文本内容
- **明信片 ID：如果提供了 postcardId 参数，必须直接使用该值，不要从邮件内容中重新提取！这是最重要的字段。**
- 收件人信息：在邮件正文的 "About the recipient" 部分
- 其他字段格式与粘贴邮件类似`;

    case 'postcrossing_profile':
      return basePrompt + `

用户简介格式说明（Postcrossing traveling 页面）：
- 这是从 Postcrossing travelingpostcard 页面获取的用户简介
- 用户会介绍自己的姓名、国家、城市、兴趣爱好等
- 可能包含语言偏好、卡片偏好等信息
- 从简介文本中智能提取结构化信息`;

    default:
      return basePrompt;
  }
}

/**
 * 构建用户提示词
 */
function buildUserPrompt(content: string, config: ParseConfig): string {
  const parts: string[] = [];

  // 根据来源添加不同的提示
  switch (config.source) {
    case 'pasted_email':
      parts.push(`邮件内容：
${content}`);
      break;

    case 'imap_email':
      // 优先使用传入的 postcardId，让 AI 参考使用
      if (config.extraInfo?.postcardId) {
        parts.push(`明信片 ID：${config.extraInfo.postcardId}（请优先使用此 ID）`);
      }
      if (config.extraInfo?.subject || config.extraInfo?.emailSubject) {
        parts.push(`邮件主题：${config.extraInfo.subject || config.extraInfo.emailSubject}`);
      }
      if (config.extraInfo?.from || config.extraInfo?.emailFrom) {
        parts.push(`发件人：${config.extraInfo.from || config.extraInfo.emailFrom}`);
      }
      parts.push(`邮件正文：
${content}`);
      break;

    case 'postcrossing_profile':
      parts.push(`用户简介：
${content}`);
      
      if (config.extraInfo?.receiverUsername) {
        parts.push(`用户名：${config.extraInfo.receiverUsername}`);
      }
      if (config.extraInfo?.postcardId) {
        parts.push(`明信片 ID: ${config.extraInfo.postcardId}`);
      }
      break;
  }

  return parts.join('\n\n');
}

/**
 * 使用 AI 解析内容（统一入口）
 * 
 * @param content - 待解析的内容（邮件正文或简介）
 * @param config - 解析配置
 */
export async function parseWithAI(
  content: string,
  config: ParseConfig
): Promise<AIParsedResult> {
  console.log(`[parseWithAI] 开始解析，来源：${config.source}, 内容长度：${content.length}`);
  
  // 如果内容为空，返回默认值
  if (!content || content.trim().length === 0) {
    console.log('[parseWithAI] 内容为空，返回默认值');
    return getDefaultResult(config.source);
  }
  
  // 从数据库动态获取 AI 配置并创建客户端
  const [aiConfig, openai] = await Promise.all([
    getAIConfigFromDB(),
    createOpenAIClient(),
  ]);
  
  const systemPrompt = buildSystemPrompt(config.source);
  const userPrompt = buildUserPrompt(content, config);
  
  // 打印必要配置用于调试，避免输出完整原文与提示词
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[AI Request] 配置信息:');
  console.log(`  → baseUrl: ${aiConfig.baseUrl}`);
  console.log(`  → model: ${aiConfig.model}`);
  console.log(`  → temperature: 0.5`);
  console.log(`  → max_tokens: 2000`);
  console.log(`  → source: ${config.source}`);
  console.log(`  → contentLength: ${content.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const completion = await openai.chat.completions.create({
      model: aiConfig.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.5,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0]?.message?.content || '';
    console.log(`[parseWithAI] AI 响应：${responseText.substring(0, 500)}...`);
    
    // 提取 JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('[parseWithAI] JSON 解析成功:', parsed);
      
      return {
        name: parsed.name || 'Unknown',
        country: (parsed.country && parsed.country !== 'undefined') ? parsed.country : '',
        city: (parsed.city && parsed.city !== 'undefined') ? parsed.city : '',
        address: parsed.address || '',
        postcardId: parsed.postcardId || config.extraInfo?.postcardId || '',
        distance: parsed.distance ? Number(parsed.distance) : undefined,
        interests: Array.isArray(parsed.interests) ? parsed.interests : [],
        dislikes: Array.isArray(parsed.dislikes) ? parsed.dislikes : [],
        messageToSender: parsed.messageToSender || '',
        cardPreference: parsed.cardPreference || 'any',
        contentPreference: parsed.contentPreference || '',
        languagePreference: parsed.languagePreference || '',
        specialRequests: parsed.specialRequests || 'none',
        // 额外字段
        age: parsed.age ? Number(parsed.age) : undefined,
        gender: parsed.gender || undefined,
        cardsSent: parsed.cardsSent ? Number(parsed.cardsSent) : undefined,
        cardsReceived: parsed.cardsReceived ? Number(parsed.cardsReceived) : undefined,
        languages: Array.isArray(parsed.languages) ? parsed.languages : undefined,
        // 来源信息
        source: config.source,
        profileRaw: config.source === 'postcrossing_profile' ? content : undefined,
        // 素材检查（Step 1 通用）
        hasMaterials: false, // 由调用方传入 materials 后判断
        filledMaterialsCategories: [],
      };
    } else {
      console.log('[parseWithAI] 未找到 JSON 格式');
    }
  } catch (error) {
    console.error('[parseWithAI] AI 解析错误:', error);
  }

  // AI 解析失败，返回默认值
  console.log('[parseWithAI] 返回默认值');
  return getDefaultResult(config.source);
}

/**
 * 获取默认解析结果
 */
function getDefaultResult(source: ContentSource): AIParsedResult {
  return {
    name: 'Unknown',
    country: '',
    city: '',
    address: '',
    postcardId: '',
    distance: undefined,
    interests: [],
    dislikes: [],
    messageToSender: '',
    cardPreference: 'any',
    contentPreference: '',
    languagePreference: '',
    specialRequests: 'none',
    // 额外字段
    age: undefined,
    gender: undefined,
    cardsSent: undefined,
    cardsReceived: undefined,
    languages: undefined,
    // 来源信息
    source,
    hasMaterials: false,
    filledMaterialsCategories: [],
  };
}

/**
 * 便捷函数：解析粘贴的邮件
 */
export async function parsePastedEmail(emailContent: string): Promise<AIParsedResult> {
  return parseWithAI(emailContent, {
    source: 'pasted_email',
  });
}

/**
 * 便捷函数：解析 IMAP 邮件
 */
export async function parseIMAPEmail(
  emailContent: string,
  extraInfo?: {
    subject?: string;
    from?: string;
    postcardId?: string;
  }
): Promise<AIParsedResult> {
  return parseWithAI(emailContent, {
    source: 'imap_email',
    extraInfo,
  });
}

/**
 * 便捷函数：解析 Postcrossing 用户简介
 */
export async function parsePostcrossingProfile(
  profileText: string,
  extraInfo?: {
    receiverUsername?: string;
    postcardId?: string;
  }
): Promise<AIParsedResult> {
  return parseWithAI(profileText, {
    source: 'postcrossing_profile',
    extraInfo,
  });
}
