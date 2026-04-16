/**
 * Traveling 直连 AI 解析服务
 * 
 * 功能：从在途明信片 → 抓取收件人简介 → AI 结构化解析 → 创建 Postcard 记录
 */

import { PrismaClient } from "@prisma/client";
import { getUserProfile, getTravelingPostcardDetail, UserProfile } from "./postcrossingSyncService";

const prisma = new PrismaClient();

// AI 解析后的收件人数据结构
export interface AIParsedRecipient {
  name: string;
  country: string;
  city: string;
  address: string;
  interests: string[];
  dislikes: string[];
  messageToSender: string;
  cardPreference: string;
  contentPreference: string;
  languagePreference: string;
  specialRequests: string;
}

/**
 * 解析 Traveling 明信片（核心逻辑）
 * 
 * @param userId - 用户 ID
 * @param postcardId - 明信片 ID
 * @param cookie - Postcrossing 登录 Cookie
 * @returns 解析结果
 */
export async function parseTravelingPostcard(
  userId: string,
  postcardId: string,
  cookie: string
): Promise<{
  success: boolean;
  data?: AIParsedRecipient & {
    id: string;
    postcardId: string;
    distance: number;
    source: string;
    profileRaw: string;
  };
  error?: string;
  code?: string;
  isDuplicate?: boolean;
  duplicateInfo?: { postcardId: string; createdAt: string };
}> {
  try {
    // 1. 从数据库获取 traveling 卡片信息
    const travelingCard = await prisma.postcrossingTraveling.findFirst({
      where: {
        userId,
        postcardId,
      },
    });

    if (!travelingCard) {
      return {
        success: false,
        error: "明信片不存在",
        code: "CARD_NOT_FOUND",
      };
    }

    // 2. 检查是否已存在该 postcardId 的 Postcard 记录（重复检测）
    const existingPostcard = await prisma.postcard.findUnique({
      where: { postcardId },
    });

    if (existingPostcard) {
      // 返回已存在的数据（作为重复）
      return {
        success: true,
        data: {
          id: existingPostcard.id,
          name: existingPostcard.recipientName,
          country: existingPostcard.recipientCountry,
          city: existingPostcard.recipientCity || "",
          address: existingPostcard.recipientAddress,
          postcardId: existingPostcard.postcardId,
          distance: travelingCard.distance,
          interests: existingPostcard.recipientInterests
            ? existingPostcard.recipientInterests.split(",").map((i) => i.trim())
            : [],
          dislikes: [],
          messageToSender: "",
          cardPreference: "",
          contentPreference: "",
          languagePreference: "",
          specialRequests: "",
          source: "postcrossing",
          profileRaw: existingPostcard.recipientBio || "",
        },
        isDuplicate: true,
        duplicateInfo: {
          postcardId: existingPostcard.postcardId,
          createdAt: existingPostcard.createdAt.toISOString(),
        },
      };
    }

    // 3. 获取收件人用户名
    const receiverUsername = travelingCard.receiverUsername;

    // 4. 获取 traveling-detail 页面（收件人地址）
    let recipientName: string = receiverUsername;
    let addressImageUrl: string | undefined;
    let country = "";

    const detailResult = await getTravelingPostcardDetail(postcardId, cookie);
    
    if (detailResult.success && detailResult.data) {
      recipientName = detailResult.data.recipientName;
      addressImageUrl = detailResult.data.addressImageUrl;
      country = detailResult.data.country || "";
    }

    // 5. 获取收件人简介（aboutText）
    const profileResult = await getUserProfile(receiverUsername, cookie);
    
    let aboutText = "";
    let isPrivate = false;

    if (profileResult.success && profileResult.data) {
      aboutText = profileResult.data.aboutText;
    } else if (profileResult.isPrivate) {
      isPrivate = true;
    }

    // 6. 如果是私密用户，返回特定错误
    if (isPrivate) {
      return {
        success: false,
        error: "该用户资料设置为私密，无法获取简介",
        code: "PROFILE_PRIVATE",
        suggestion: "你可以手动粘贴该用户的邮件内容来解析",
      };
    }

    // 7. AI 结构化解析 aboutText
    const parsedData = await aiParseUserProfile(
      aboutText,
      travelingCard.countryCode,
      receiverUsername,
      country
    );

    // 8. 合并地址信息（优先使用 traveling-detail 获取的数据）
    // 注意：地址现在是图片形式（addressImageUrl），需要 OCR 才能获取文字
    const finalData: AIParsedRecipient = {
      ...parsedData,
      // 如果 traveling-detail 获取到了收件人姓名，使用它
      name: recipientName !== receiverUsername ? recipientName : parsedData.name,
      // 地址现在通过 addressImageUrl 提供，文字地址暂时无法获取
      address: parsedData.address, // 保留 AI 解析的地址（如有）
      city: parsedData.city,
      country: country || parsedData.country,
    };

    // 额外返回 addressImageUrl（通过其他方式传递，因为 AIParsedRecipient 没有这个字段）

    // 9. 创建 Postcard 记录
    const postcard = await prisma.postcard.create({
      data: {
        userId,
        postcardId,
        recipientName: finalData.name,
        recipientAddress: finalData.address,
        recipientCountry: finalData.country,
        recipientCity: finalData.city,
        recipientInterests: finalData.interests.join(", "),
        recipientBio: aboutText,
        status: "draft",
      },
    });

    // 10. 返回解析结果
    return {
      success: true,
      data: {
        id: postcard.id,
        postcardId,
        ...finalData,
        distance: travelingCard.distance,
        source: "postcrossing",
        profileRaw: aboutText,
      },
    };
  } catch (error) {
    // console.error("解析 Traveling 明信片错误:", error);
    return {
      success: false,
      error: "解析失败，请稍后重试",
      code: "PARSE_FAILED",
    };
  }
}

/**
 * AI 结构化解析用户简介
 * 
 * @param aboutText - 用户简介文本
 * @param countryCode - 国家代码
 * @param username - 用户名
 * @param countryFromDetail - 从 traveling-detail 获取的国家名称
 */
async function aiParseUserProfile(
  aboutText: string,
  countryCode: string,
  username: string,
  countryFromDetail?: string
): Promise<AIParsedRecipient> {
  // 如果没有 aboutText，返回基础信息
  if (!aboutText || aboutText.length < 20) {
    const fallbackCountry = countryFromDetail || countryCodeToName(countryCode);
    return {
      name: username,
      country: fallbackCountry,
      city: "",
      address: "",
      interests: [],
      dislikes: [],
      messageToSender: "",
      cardPreference: "any",
      contentPreference: "general topics",
      languagePreference: "",
      specialRequests: "",
    };
  }

  // 构建 AI prompt
  const systemPrompt = `你是一个 Postcrossing 收件人信息提取助手。请从以下 Postcrossing 用户简介中提取收件人的关键信息，用于生成个性化明信片内容。

上下文信息：
- 用户名：${username}
- 所在国家代码：${countryCode}

请从简介中提取以下信息，严格按照 JSON 格式返回：

{
  "name": "用户的真实姓名或昵称",
  "country": "所在国家的英文名称",
  "city": "所在城市（如果能识别）",
  "interests": ["兴趣1", "兴趣2", ...],
  "dislikes": ["厌恶1", "厌恶2", ...],
  "messageToSender": "用户想对收件人说的话（如果有）",
  "cardPreference": "对明信片外观的偏好（如 any, handmade, landscape 等）",
  "contentPreference": "对内容的偏好（如 general topics, culture, nature 等）",
  "languagePreference": "语言偏好",
  "specialRequests": "特殊规则或请求"
}

提取规则：
1. name：从简介中找到的真实姓名或昵称，如果没有则使用 ${username}
2. country：基于 ${countryCode} 转换为国名，如果简介中有更具体的描述则用简介中的
3. city：如果能从简介中识别城市名则提取，否则留空 ""
4. interests：从简介中提取用户提到的所有兴趣、爱好、喜欢的事物，用英文小写
5. dislikes：提取用户明确表示不喜欢的事物，没有则为空数组 []
6. messageToSender：用户想对寄信人问的问题或说的话
7. cardPreference/postcardPreference：用户对明信片类型的偏好
8. contentPreference：用户想收到什么内容的明信片
9. languagePreference：用户提到的语言
10. specialRequests：用户提到的任何特殊请求或规则

重要：
- 只返回 JSON，不要其他内容
- 无法确定的字段使用 "" 或 []
- interests 和 dislikes 用纯英文小写，不用 | 分隔
- 简介原文可能是 HTML 清理后的纯文本，请正确理解内容`;

  const userPrompt = `用户简介内容：
${aboutText}

国家代码：${countryCode}
用户名：${username}`;

  try {
    // 调用 AI 服务
    const response = await fetch(process.env.AI_API_URL || "https://api.qwen.qww.xyz/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.AI_API_KEY || ""}`,
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || "qwen3.6-plus",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "{}";

    // 解析 JSON
    const parsed = JSON.parse(content);

    return {
      name: parsed.name || username,
      country: parsed.country || countryCodeToName(countryCode),
      city: parsed.city || "",
      address: "",
      interests: Array.isArray(parsed.interests) ? parsed.interests : [],
      dislikes: Array.isArray(parsed.dislikes) ? parsed.dislikes : [],
      messageToSender: parsed.messageToSender || "",
      cardPreference: parsed.cardPreference || "any",
      contentPreference: parsed.contentPreference || "general topics",
      languagePreference: parsed.languagePreference || "",
      specialRequests: parsed.specialRequests || "",
    };
  } catch (error) {
    // console.error("AI 解析错误:", error);
    // 降级返回基础信息
    return {
      name: username,
      country: countryFromDetail || countryCodeToName(countryCode),
      city: "",
      address: "",
      interests: [],
      dislikes: [],
      messageToSender: "",
      cardPreference: "any",
      contentPreference: "general topics",
      languagePreference: "",
      specialRequests: "",
    };
  }
}

// 国家代码转国家名称
function countryCodeToName(code: string): string {
  const map: Record<string, string> = {
    AD: "Andorra", AE: "United Arab Emirates", AF: "Afghanistan", AG: "Antigua and Barbuda",
    AL: "Albania", AM: "Armenia", AO: "Angola", AR: "Argentina", AT: "Austria", AU: "Australia",
    AW: "Aruba", AZ: "Azerbaijan", BA: "Bosnia and Herzegovina", BB: "Barbados", BD: "Bangladesh",
    BE: "Belgium", BF: "Burkina Faso", BG: "Bulgaria", BH: "Bahrain", BI: "Burundi", BJ: "Benin",
    BM: "Bermuda", BN: "Brunei", BO: "Bolivia", BR: "Brazil", BS: "Bahamas", BT: "Bhutan",
    BW: "Botswana", BY: "Belarus", BZ: "Belize", CA: "Canada", CD: "DR Congo", CF: "Central African Republic",
    CG: "Republic of Congo", CH: "Switzerland", CI: "Ivory Coast", CL: "Chile", CM: "Cameroon",
    CN: "China", CO: "Colombia", CR: "Costa Rica", CU: "Cuba", CV: "Cape Verde", CY: "Cyprus",
    CZ: "Czech Republic", DE: "Germany", DJ: "Djibouti", DK: "Denmark", DM: "Dominica",
    DO: "Dominican Republic", DZ: "Algeria", EC: "Ecuador", EE: "Estonia", EG: "Egypt",
    ER: "Eritrea", ES: "Spain", ET: "Ethiopia", FI: "Finland", FJ: "Fiji", FM: "Micronesia",
    FR: "France", GA: "Gabon", GB: "United Kingdom", GD: "Grenada", GE: "Georgia", GH: "Ghana",
    GM: "Gambia", GN: "Guinea", GQ: "Equatorial Guinea", GR: "Greece", GT: "Guatemala",
    GW: "Guinea-Bissau", GY: "Guyana", HN: "Honduras", HR: "Croatia", HT: "Haiti", HU: "Hungary",
    ID: "Indonesia", IE: "Ireland", IL: "Israel", IN: "India", IQ: "Iraq", IR: "Iran",
    IS: "Iceland", IT: "Italy", JM: "Jamaica", JO: "Jordan", JP: "Japan", KE: "Kenya",
    KG: "Kyrgyzstan", KH: "Cambodia", KI: "Kiribati", KM: "Comoros", KN: "Saint Kitts and Nevis",
    KP: "North Korea", KR: "South Korea", KW: "Kuwait", KZ: "Kazakhstan", LA: "Laos",
    LB: "Lebanon", LC: "Saint Lucia", LI: "Liechtenstein", LK: "Sri Lanka", LR: "Liberia",
    LS: "Lesotho", LT: "Lithuania", LU: "Luxembourg", LV: "Latvia", LY: "Libya", MA: "Morocco",
    MC: "Monaco", MD: "Moldova", ME: "Montenegro", MG: "Madagascar", MH: "Marshall Islands",
    MK: "North Macedonia", ML: "Mali", MM: "Myanmar", MN: "Mongolia", MR: "Mauritania",
    MT: "Malta", MU: "Mauritius", MV: "Maldives", MW: "Malawi", MX: "Mexico", MY: "Malaysia",
    MZ: "Mozambique", NA: "Namibia", NE: "Niger", NG: "Nigeria", NI: "Nicaragua", NL: "Netherlands",
    NO: "Norway", NP: "Nepal", NR: "Nauru", NZ: "New Zealand", OM: "Oman", PA: "Panama",
    PE: "Peru", PG: "Papua New Guinea", PH: "Philippines", PK: "Pakistan", PL: "Poland",
    PT: "Portugal", PW: "Palau", PY: "Paraguay", QA: "Qatar", RO: "Romania", RS: "Serbia",
    RU: "Russia", RW: "Rwanda", SA: "Saudi Arabia", SB: "Solomon Islands", SC: "Seychelles",
    SD: "Sudan", SE: "Sweden", SG: "Singapore", SI: "Slovenia", SK: "Slovakia", SL: "Sierra Leone",
    SM: "San Marino", SN: "Senegal", SO: "Somalia", SR: "Suriname", SS: "South Sudan",
    SV: "El Salvador", SY: "Syria", SZ: "Eswatini", TD: "Chad", TG: "Togo", TH: "Thailand",
    TJ: "Tajikistan", TL: "Timor-Leste", TM: "Turkmenistan", TN: "Tunisia", TO: "Tonga",
    TR: "Turkey", TT: "Trinidad and Tobago", TV: "Tuvalu", TZ: "Tanzania", UA: "Ukraine",
    UG: "Uganda", US: "United States", UY: "Uruguay", UZ: "Uzbekistan", VC: "Saint Vincent",
    VE: "Venezuela", VN: "Vietnam", VU: "Vanuatu", WS: "Samoa", YE: "Yemen", ZA: "South Africa",
    ZM: "Zambia", ZW: "Zimbabwe"
  };
  return map[code.toUpperCase()] || code;
}