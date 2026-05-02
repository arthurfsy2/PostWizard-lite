import OpenAI from 'openai';
import { prisma } from '../prisma';
import { getConfigForPurpose, createOpenAIWithProxy } from './ai-config';

export interface OcrResult {
  postcardId?: string;
  senderUsername?: string;
  senderCountry?: string;
  senderCity?: string;
  handwrittenText: string;
  translatedText?: string;
  detectedLanguage: string;
  confidence: number;
  specialNotes?: string;
  model?: string;
}

const ocrPrompt = `请仔细识别这张明信片背面的所有手写文字内容。

【输出格式】
直接输出纯 JSON 对象，禁止使用 Markdown 代码块。
{
  "postcardId": "明信片 ID（如 AB-1234567），未识别到则为空字符串",
  "senderUsername": "寄件人用户名，未识别到则为空字符串",
  "senderCountry": "2 字母国家代码（如 JP/US/DE），不确定则为空字符串",
  "senderCity": "城市名，未识别到则为空字符串",
  "handwrittenText": "手写内容原文（不翻译，保持原语言）",
  "translatedText": "手写内容的中文翻译",
  "detectedLanguage": "语言代码（如 en/zh/ja/de/fr/ru）",
  "specialNotes": "特殊情况说明，无则为空字符串"
}

【Postcard ID 识别 — 最高优先级】
Postcrossing 明信片通常有唯一 ID，格式：2 个大写字母-数字（如 AB-1234567），6-8 位数字不等。
- 搜索范围：四角、左侧/右侧边缘、邮戳附近、邮票下方、收件地址区域旁边
- ID 可能是手写体（字迹潦草）、竖排印刷、被部分遮挡
- 俄罗斯手写体中 R 可能像 Я，U 可能像 Ч，请结合上下文推断
- 竖排 ID 需逐字辨认后拼接为横排（如竖排 C、N、-、1、2、3 → CN-123）
- ID 可能带有 "No."、"ID:"、"#" 前缀，也可能只有数字（如 1976652）
- 如果只找到部分数字也请填入，前 2 个字母可推测 senderCountry（RU→俄罗斯、CN→中国、FR→法国）
- **绝对不能编造**：未识别到则返回空字符串 ""

【排除规则 — 以下内容不属于手写正文，必须移除】
- **收件地址块（最重要！）**：明信片上通常有一个完整的收件人地址区域，包含以下全部或部分内容：
  - 邮编（中国 6 位数字如 518081、518083；其他国家 4-7 位）
  - 中文地址词：省、市、区、街道、路、号、栋、楼、室、小区、花园、村、镇、试投、投递
  - 英文地址词：District、City、Province、Road、Street、Building、Room、Floor、Block
  - 收件人姓名（大写英文名如 FENG SIYUAN、ZHANG SAN）
  - **整个地址块必须作为一个整体移除**，即使其中夹杂着看似有意义的文字
  - 判断方法：如果一段文字中同时包含邮编+地名/楼号，就是地址，整段删除
- "To:"、"Dear xxx" 等收件人称呼（但正文中的 "Hello friend"、"Hello everyone" 等问候保留）
- 邮戳、条形码、二维码等印刷信息
- 明信片 ID 编码（放入 postcardId 字段，不放入正文）

【其他规则】
- 国家代码使用 ISO 3166-1 alpha-2 格式
- 无法识别的字符用 [?] 代替
- 人名保留原文不翻译
- 换行符合自然语义`;

/**
 * 识别明信片背面手写内容（多轮投票机制）
 * @param imageBase64 Base64 编码的图片数据
 * @param multipleRounds 识别轮数，默认 2 轮
 */
export async function recognizePostcard(imageBase64: string, multipleRounds: number = 2): Promise<OcrResult> {
  try {
    const aiConfig = await getConfigForPurpose('ocr');
    const client = await createOpenAIWithProxy(aiConfig);

    const allResults: OcrResult[] = [];
    let quotaExhausted = false;
    let completedRounds = 0;
    let retries429 = 0;
    const maxRetries429 = 3;
    let i = 0;

    while (completedRounds < multipleRounds) {
      try {
        if (completedRounds > 0 || retries429 > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        const response = await client.chat.completions.create({
          model: aiConfig.model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${imageBase64}`,
                  },
                },
                {
                  type: 'text',
                  text: ocrPrompt,
                },
              ],
            },
          ],
          temperature: 0.1,
          max_tokens: 2000,
        });
        const content = response.choices[0]?.message?.content || '';
        const result = parseOcrResponse(content);
        allResults.push(result);
        completedRounds++;
        i++;
      } catch (roundError: any) {
        i++;
        console.warn(`[OCR] Round ${i} failed:`, roundError.message);
        // 记录 403 错误，用于后续判断是否为配额耗尽
        if (roundError?.status === 403 || roundError?.message?.includes('403') || roundError?.message?.includes('free tier')) {
          quotaExhausted = true;
        }
        // 429 频率限制：等待 RPM 窗口重置后重试
        if (roundError?.status === 429 || roundError?.message?.includes('429')) {
          retries429++;
          if (retries429 > maxRetries429) {
            console.warn(`[OCR] 429 频率限制，已重试 ${maxRetries429} 次，放弃`);
            break;
          }
          const waitMs = retries429 * 5000; // 5s, 10s, 15s（Tier 1 限额高，短暂等待即可）
          console.warn(`[OCR] 429 频率限制，等待 ${waitMs / 1000}s 后重试 (${retries429}/${maxRetries429})`);
          await new Promise(resolve => setTimeout(resolve, waitMs));
          continue;
        }
        // 检测不支持图片的错误，直接终止（不需要重试）
        if (roundError?.message?.includes('image_url') && roundError?.message?.includes('unknown variant')) {
          throw new Error(`当前模型 "${aiConfig.model}" 不支持图片识别。请在设置中为"图片识别"配置一个支持视觉的模型（如 qwen-vl-plus、gemini-2.0-flash、gpt-4o 等）。`);
        }
      }
    }

    if (allResults.length === 0) {
      if (quotaExhausted) {
        throw new Error('OCR_QUOTA_EXHAUSTED: AI 服务免费额度已耗尽，请联系管理员升级 API 套餐');
      }
      throw new Error('所有识别轮次均失败，请稍后重试');
    }

    const best = voteBestResult(allResults);
    best.model = aiConfig.model;
    console.log(`[OCR] ${allResults.length} rounds completed, postcardId="${best.postcardId || ''}", confidence=${best.confidence}, model=${aiConfig.model}, handwrittenTextLen=${(best.handwrittenText || '').length}`);
    return best;
  } catch (error: any) {
    throw new Error(`OCR 识别失败：${error.message}`);
  }
}

/**
 * 多次识别结果投票，选择最佳结果
 */
function voteBestResult(results: OcrResult[]): OcrResult {
  if (results.length === 0) {
    return {
      handwrittenText: '',
      detectedLanguage: 'unknown',
      confidence: 0,
    };
  }

  if (results.length === 1) {
    return results[0];
  }

  // 1. PostcardId 投票
  const postcardIdVotes = new Map<string, number>();
  for (const r of results) {
    if (r.postcardId) {
      const count = postcardIdVotes.get(r.postcardId) || 0;
      postcardIdVotes.set(r.postcardId, count + 1);
    }
  }
  let bestPostcardId: string | undefined;
  let maxPostcardIdVotes = 0;
  for (const [id, count] of postcardIdVotes) {
    if (count > maxPostcardIdVotes) {
      maxPostcardIdVotes = count;
      bestPostcardId = id;
    }
  }

  // 2. SenderCountry 投票
  const countryVotes = new Map<string, number>();
  for (const r of results) {
    if (r.senderCountry) {
      const count = countryVotes.get(r.senderCountry) || 0;
      countryVotes.set(r.senderCountry, count + 1);
    }
  }
  let bestCountry: string | undefined;
  let maxCountryVotes = 0;
  for (const [country, count] of countryVotes) {
    if (count > maxCountryVotes) {
      maxCountryVotes = count;
      bestCountry = country;
    }
  }

  // 3. SenderUsername 投票
  const usernameVotes = new Map<string, number>();
  for (const r of results) {
    if (r.senderUsername) {
      const count = usernameVotes.get(r.senderUsername) || 0;
      usernameVotes.set(r.senderUsername, count + 1);
    }
  }
  let bestUsername: string | undefined;
  let maxUsernameVotes = 0;
  for (const [username, count] of usernameVotes) {
    if (count > maxUsernameVotes) {
      maxUsernameVotes = count;
      bestUsername = username;
    }
  }

  // 4. 语言投票
  const langVotes = new Map<string, number>();
  for (const r of results) {
    if (r.detectedLanguage && r.detectedLanguage !== 'unknown') {
      const count = langVotes.get(r.detectedLanguage) || 0;
      langVotes.set(r.detectedLanguage, count + 1);
    }
  }
  let bestLang: string = 'unknown';
  let maxLangVotes = 0;
  for (const [lang, count] of langVotes) {
    if (count > maxLangVotes) {
      maxLangVotes = count;
      bestLang = lang;
    }
  }

  // 5. 选择置信度最高的手写文本（选择投票数最多的字段组合对应的结果）
  // 综合得分 = postcardId投票权重 + country投票权重 + username投票权重
  let bestResult = results[0];
  let bestScore = 0;
  
  for (const r of results) {
    let score = 0;
    if (r.postcardId === bestPostcardId) score += 3;
    if (r.senderCountry === bestCountry) score += 3;
    if (r.senderUsername === bestUsername) score += 2;
    if (r.detectedLanguage === bestLang) score += 1;
    score += r.confidence;
    
    if (score > bestScore) {
      bestScore = score;
      bestResult = r;
    }
  }

  // 使用投票结果组合最终答案
  return {
    postcardId: bestPostcardId,
    senderUsername: bestUsername,
    senderCountry: bestCountry,
    senderCity: bestResult.senderCity,
    handwrittenText: bestResult.handwrittenText,
    translatedText: bestResult.translatedText,
    detectedLanguage: bestLang,
    confidence: (maxPostcardIdVotes + maxCountryVotes + maxUsernameVotes + maxLangVotes) / (4 * results.length),
    specialNotes: bestResult.specialNotes,
  };
}

/**
 * 解析 OCR 响应（支持纯 JSON 和 Markdown 包裹的 JSON）
 */
function parseOcrResponse(content: string): OcrResult {
  console.log('[OCR] Raw AI response length:', content.length, 'preview:', content.substring(0, 200));
  try {
    // 清理内容：移除可能的 Markdown 代码块标记
    let jsonStr = content.trim();
    
    // 移除 ```json 和 ``` 等代码块标记
    jsonStr = jsonStr.replace(/^```json\s*/i, '');
    jsonStr = jsonStr.replace(/^```\s*/i, '');
    jsonStr = jsonStr.replace(/\s*```$/i, '');
    
    // 尝试提取 JSON 对象
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('[OCR] Parsed fields:', {
        postcardId: parsed.postcardId,
        senderCountry: parsed.senderCountry,
        handwrittenTextLen: (parsed.handwrittenText || '').length,
        detectedLanguage: parsed.detectedLanguage,
      });

      const senderCountry = parsed.senderCountry || undefined;
      // 校验 postcardId 格式：必须是 2个大写字母-数字（如 AB-1234567），否则丢弃
      let postcardId: string | undefined = undefined;
      if (parsed.postcardId && /^[A-Z]{2}-\d{5,8}$/.test(parsed.postcardId)) {
        postcardId = parsed.postcardId;
      } else if (parsed.postcardId) {
        console.log(`[OCR] postcardId "${parsed.postcardId}" 格式不符，已丢弃`);
      }
      
      return {
        postcardId: postcardId || undefined,
        senderUsername: parsed.senderUsername || undefined,
        senderCountry,
        senderCity: parsed.senderCity || undefined,
        handwrittenText: parsed.handwrittenText || '',
        translatedText: parsed.translatedText || undefined,
        detectedLanguage: parsed.detectedLanguage || 'unknown',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        specialNotes: parsed.specialNotes || undefined,
      };
    }
    
    // 如果解析失败，返回原始文本
    console.log('[OCR] JSON parse failed, returning raw text');
    return {
      handwrittenText: content,
      detectedLanguage: 'unknown',
      confidence: 0.5,
    };
  } catch (error) {
    console.error('[OCR] parseOcrResponse error:', (error as Error).message);
    return {
      handwrittenText: content,
      detectedLanguage: 'unknown',
      confidence: 0.5,
    };
  }
}

/**
 * 检查用户 OCR 额度
 * 额度规则：
 * - 免费用户：初始5次 + 奖励额度（反馈+邀请），永久有效，用完即止
 * - 付费用户：会员期内无限使用
 */
export async function checkOcrQuota(userId: string): Promise<{
  canUse: boolean;
  remaining: number;
  isPremium: boolean;
}> {
  // 开源版：无额度限制
  return {
    canUse: true,
    remaining: Infinity,
    isPremium: false,
  };
}

/**
 * 消耗用户 OCR 额度
 * 额度规则：
 * - 免费用户：初始5次 + 奖励额度（反馈+邀请），永久有效，用完即止
 * - 付费用户：会员期内无限使用，不消耗额度
 */
export async function consumeOcrQuota(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      plan: true,
      planExpiresAt: true,
      freeUsedCount: true,
      bonusQuota: true,
      referralBonusQuota: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // 付费用户不消耗额度
  const isPremium = user.plan && user.plan !== 'free' && user.planExpiresAt && new Date(user.planExpiresAt) > new Date();
  if (isPremium) {
    return Infinity;
  }

  // 免费用户：消耗额度（增加使用计数）
  const newFreeUsedCount = (user.freeUsedCount || 0) + 1;
  await prisma.user.update({
    where: { id: userId },
    data: {
      freeUsedCount: newFreeUsedCount,
    },
  });

  // 返回剩余额度 = 总额度 - 新的已使用次数
  // 从 Settings 读取基础额度配置
  const settings = await prisma.settings.findUnique({
    where: { key: 'newUserFreeQuota' }
  });
  const BASE_QUOTA = settings ? parseInt(settings.value, 10) : 5;
  const totalQuota = BASE_QUOTA + (user.bonusQuota || 0) + (user.referralBonusQuota || 0);
  
  return Math.max(0, totalQuota - newFreeUsedCount);
}
