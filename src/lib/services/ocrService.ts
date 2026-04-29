import OpenAI from 'openai';
import { prisma } from '../prisma';
import { getAIConfigFromDB } from './ai-config';

// OCR 模型配置（fallback 使用）
const OCR_MODEL = process.env.OCR_MODEL || '';

export interface OcrResult {
  postcardId?: string;         // 明信片 ID（如 AB-1234567）
  postcardIdConfidence?: number; // Postcard ID 识别置信度
  senderUsername?: string;
  senderCountry?: string;
  senderCity?: string;
  handwrittenText: string;     // 手写原文
  translatedText?: string;     // 中文翻译
  detectedLanguage: string;
  confidence: number;
  specialNotes?: string;
}

/**
 * 识别明信片背面手写内容（使用多次识别投票机制）
 * @param imageBase64 Base64 编码的图片数据
 * @param multipleRounds 识别轮数，默认 3 轮
 */
export async function recognizePostcard(imageBase64: string, multipleRounds: number = 2): Promise<OcrResult> {
  const ocrPrompt = `请仔细识别这张明信片背面的所有手写文字内容。

重要约束（必须严格遵守）：
1. **禁止输出任何 Markdown 格式标记**（不要使用 \`\`\`json、\`\`\` 等代码块）
2. **直接输出纯 JSON 对象**，不要有任何前缀或后缀
3. **忽略收件地址信息**（如 To: xxx, 地址等）
4. **忽略明信片本身的印刷文字**（如品牌名、装饰性文字等），只识别手写内容
5. **如果发现 DE-XXXX、FR-XXXX、RU-XXXX 等格式的编码**，可用于推测来源国家（DE=德国、FR=法国、NL=荷兰、JP=日本、US=美国、RU=俄罗斯 等）
6. **postcardId 绝对不能编造**：只有图片中确实可见 ID 编码时才返回，否则必须返回空字符串 ""

【🔴 Postcard ID 识别 — 最高优先级】
Postcrossing 明信片通常有一个唯一 ID（格式：2 个大写字母-7 位数字，如 AB-1234567、XY-9876543）。
- **必须仔细检查图片的每一个角落**：四角、左侧边缘、右侧边缘、邮戳附近、邮票下方、收件地址区域旁边
- **ID 可能是手写体**（非印刷），字迹可能潦草，请根据上下文推断（如 R 和 U 的手写体可能看起来像其他字母）
- **ID 可能是竖排的**（与正文垂直），需要逐字辨认后拼接为横排。特别注意图片左侧或右侧边缘的竖排手写内容
- **ID 可能被部分遮挡**（邮戳覆盖、邮票遮挡），请尽量识别可见部分
- **请仔细数清数字位数**：ID 的数字位数因国家而异（6-8 位不等），请逐字辨认，确保每一位数字都被准确识别，不要遗漏
- 如果只找到部分数字（如 1234567），也请填入 postcardId 字段（可省略国家前缀）
- 识别到 ID 后，前 2 个字母可用于推测 senderCountry（如 RU→俄罗斯、CN→中国、FR→法国）

【🔴 排除规则 — 以下内容不属于手写正文，必须从 handwrittenText 中移除】
- **收件人地址（最重要！）**：明信片右侧或底部的收件人地址区域，通常包含：人名、街道名+门牌号、小区/楼栋+房间号、District、City、邮编（6位数字如518083）、Province、Country。这些内容即使全部是手写的，也**绝对不能**包含在 handwrittenText 中
  - 典型模式："人名 + 街道/小区 + 房间号 + District + City + 邮编 + Province + Country"
  - 示例：如 "Zhang San FengTai District Beijing 100000 China" 这类结构全部是收件地址，必须排除
  - 包含邮编（5-6位连续数字）的段落通常是地址
  - 包含 "District"、"City"、"Province"、"PR"、"China"、"Road"、"Street"、"Building"、"Room" 等词的段落通常是地址
- "To:"、"Dear xxx" 等收件人称呼（但信件正文中的称呼如 "Hello friend" 保留）
- 邮戳、条形码、二维码等印刷信息
- 明信片 ID 编码（如 RU-1234567）——此 ID 放入 postcardId 字段，不要放入正文

请以纯 JSON 格式返回，包含以下字段：
{
  "postcardId": "明信片 ID（如 AB-1234567），未识别到则为空字符串",
  "postcardIdConfidence": "postcardId 识别置信度，0.0-1.0 之间的浮点数",
  "senderUsername": "寄件人用户名，未识别到则为空字符串",
  "senderCountry": "寄件人国家 2 字母代码（如 JP/US/DE），未识别到则为空字符串",
  "senderCity": "寄件人城市，未识别到则为空字符串",
  "handwrittenText": "手写内容的原文转录（不翻译，保持原语言）",
  "translatedText": "手写内容的中文翻译",
  "detectedLanguage": "手写内容的语言代码（如 en/zh/ja/de/fr/ru）",
  "confidence": "整体识别置信度，0.0-1.0 之间的浮点数",
  "specialNotes": "特殊情况说明，无则为空字符串"
}

【关键规则】
- postcardId：必须从图片中实际识别到的明信片 ID，格式为 2 个大写字母-数字（如 AB-1234567）
- 如果图片中没有明信片 ID，postcardId 必须为空字符串 ""，绝对不能编造或猜测
- senderCountry：必须为 2 字母 ISO 国家代码（如 JP/US/DE/NL/FR），不确定时为空字符串
- senderUsername：未识别到时为空字符串

识别要点：
- Postcard ID 通常位于明信片右上角或左上角，格式：2 个大写字母-数字（如 AB-1234567、XY-9876543）
- **注意手写 ID**：有些明信片的 ID 是手写体（非印刷），需要仔细辨认字母和数字。俄罗斯等地区的手写体可能带有西里尔字母风格（如 R 看起来像 Я，U 看起来像 Ч），请结合上下文推断
- **注意竖写 ID**：有些明信片的 ID 是竖着印刷的（与正文垂直），请旋转图片仔细辨认，将竖排字符正确拼接为横排格式（如竖排的 C、N、-、1、2、3 应读取为 CN-123）
- **注意变体格式**：ID 可能带有 "No."、"ID:"、"#" 等前缀标签，也可能只有数字（如 1976652），请尽量识别并填入 postcardId 字段
- **搜索范围扩展**：如果右上/左上未找到，请检查邮戳附近、邮票区域、明信片底部边缘、左侧边缘（竖排手写 ID 常见位置）
- 用户名通常在明信片左上角或右上角
- 国家代码请使用 ISO 3166-1 alpha-2 格式
- 无法识别的字符用 [?] 代替
- 人名保留原文不翻译
- 换行符合自然语义`;

  try {
    // 从数据库动态获取 AI 配置并创建客户端
    const aiConfig = await getAIConfigFromDB();
    const client = new OpenAI({
      apiKey: aiConfig.apiKey,
      baseURL: aiConfig.baseUrl,
    });
    
    // 串行调用，每轮间隔 500ms 避免触发 API 速率限制
    // 如果首轮置信度 >= 0.9，跳过后续轮次以节省 API 调用
    const CONFIDENCE_THRESHOLD = 0.9;
    const allResults: OcrResult[] = [];
    
    for (let i = 0; i < multipleRounds; i++) {
      try {
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        const response = await client.chat.completions.create({
          model: OCR_MODEL || aiConfig.model,
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
          temperature: 0.1 + (i * 0.1),
          max_tokens: 2000,
        });
        const content = response.choices[0]?.message?.content || '';
        const result = parseOcrResponse(content);
        allResults.push(result);

        // 首轮高置信度，直接返回，跳过后续轮次
        if (i === 0 && result.postcardIdConfidence && result.postcardIdConfidence >= CONFIDENCE_THRESHOLD) {
          console.log(`[OCR] Round 1 high confidence (${result.postcardIdConfidence}), skipping remaining rounds`);
          return result;
        }
      } catch (roundError: any) {
        // 单轮失败不中断，继续下一轮
        console.warn(`[OCR] Round ${i + 1} failed:`, roundError.message);
      }
    }

    // 至少需要 1 个成功结果
    if (allResults.length === 0) {
      throw new Error('所有识别轮次均失败，请稍后重试');
    }

    // 投票选择最佳结果
    return voteBestResult(allResults);
  } catch (error: any) {
    // console.error('OCR recognition failed:', error);
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
    postcardIdConfidence: maxPostcardIdVotes / results.length,
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
      
      const senderCountry = parsed.senderCountry || undefined;
      const postcardId = parsed.postcardId;
      
      return {
        postcardId: postcardId || undefined,
        postcardIdConfidence: typeof parsed.postcardIdConfidence === 'number' ? parsed.postcardIdConfidence : 0.8,
        senderUsername: parsed.senderUsername || undefined,
        senderCountry,
        senderCity: parsed.senderCity || undefined,
        handwrittenText: parsed.handwrittenText || '',
        translatedText: parsed.translatedText || undefined,
        detectedLanguage: parsed.detectedLanguage || 'unknown',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.8,
        specialNotes: parsed.specialNotes || undefined,
      };
    }
    
    // 如果解析失败，返回原始文本
    return {
      handwrittenText: content,
      detectedLanguage: 'unknown',
      confidence: 0.5,
    };
  } catch (error) {
    // console.error('Failed to parse OCR response:', error);
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
