import OpenAI from "openai";
import { prisma } from "../prisma";
import { getConfigForPurpose, createOpenAIWithProxy } from "./ai-config";

export interface RecipientAnalysis {
  totalRecipients: number;
  countryDistribution: Record<string, number>;
  cityDistribution: Record<string, number>;
  ageDistribution: {
    under18: number;
    age18to30: number;
    age31to50: number;
    over50: number;
    unknown: number;
  };
  genderDistribution: Record<string, number>;
  topInterests: Record<string, number>;
}

/**
 * 分析收件人数据
 */
export async function analyzeRecipients(): Promise<RecipientAnalysis> {
  const postcards = await prisma.postcard.findMany({
    select: {
      recipientCountry: true,
      recipientCity: true,
      recipientAge: true,
      recipientGender: true,
      recipientInterests: true,
    },
  });

  const analysis: RecipientAnalysis = {
    totalRecipients: postcards.length,
    countryDistribution: {},
    cityDistribution: {},
    ageDistribution: {
      under18: 0,
      age18to30: 0,
      age31to50: 0,
      over50: 0,
      unknown: 0,
    },
    genderDistribution: {},
    topInterests: {},
  };

  postcards.forEach((postcard) => {
    // 国家分布
    if (postcard.recipientCountry) {
      analysis.countryDistribution[postcard.recipientCountry] =
        (analysis.countryDistribution[postcard.recipientCountry] || 0) + 1;
    }

    // 城市分布
    if (postcard.recipientCity) {
      analysis.cityDistribution[postcard.recipientCity] =
        (analysis.cityDistribution[postcard.recipientCity] || 0) + 1;
    }

    // 年龄分布
    if (postcard.recipientAge) {
      if (postcard.recipientAge < 18) {
        analysis.ageDistribution.under18++;
      } else if (postcard.recipientAge <= 30) {
        analysis.ageDistribution.age18to30++;
      } else if (postcard.recipientAge <= 50) {
        analysis.ageDistribution.age31to50++;
      } else {
        analysis.ageDistribution.over50++;
      }
    } else {
      analysis.ageDistribution.unknown++;
    }

    // 性别分布
    if (postcard.recipientGender) {
      analysis.genderDistribution[postcard.recipientGender] =
        (analysis.genderDistribution[postcard.recipientGender] || 0) + 1;
    }

    // 兴趣分析
    if (postcard.recipientInterests) {
      try {
        const interests = JSON.parse(postcard.recipientInterests) as string[];
        interests.forEach((interest) => {
          analysis.topInterests[interest] =
            (analysis.topInterests[interest] || 0) + 1;
        });
      } catch {
        // 如果不是 JSON，直接按字符串处理
        analysis.topInterests[postcard.recipientInterests] =
          (analysis.topInterests[postcard.recipientInterests] || 0) + 1;
      }
    }
  });

  return analysis;
}

/**
 * 分析服务类
 */
export class AnalysisService {
  /**
   * 分析收件人数据
   */
  async analyzeRecipients(): Promise<RecipientAnalysis> {
    return analyzeRecipients();
  }

  /**
   * 分析邮件内容（适配新接口）
   * 从邮件正文中提取收件人信息
   */
  async analyzeEmail(email: any) {
    const body = email.body || email.bodyText || "";

    // ── 1. 提取姓名 ────────────────────────────────────────────────────────
    let recipientName = email.recipientName || email.fromName;
    if (!recipientName || recipientName === "Unknown") {
      const namePatterns = [
        /My name is ([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/,
        /I'm ([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/,
        /I am ([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/,
        /This is ([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/,
      ];
      for (const pattern of namePatterns) {
        const match = body.match(pattern);
        if (match) {
          recipientName = match[1];
          break;
        }
      }
    }

    // ── 2. 提取城市（先于国家，避免把城市误识别为国家）──────────────────────
    let city = email.recipientCity || email.city;
    let country = email.recipientCountry || email.country;
    if (!city || city === "Unknown") {
      // 匹配 "in City, Country" 或 "in City" 格式
      const cityMatch = body.match(
        /in ([A-Z][a-z]+(?:\s[A-Z][a-z]+)*),\s*([A-Z][a-z]+)/,
      );
      if (cityMatch) {
        city = cityMatch[1];
        // 如果匹配到了 "in City, Country" 格式，同时提取国家
        if (!country || country === "Unknown") {
          country = cityMatch[2];
        }
      } else {
        // 单独匹配城市
        const cityOnlyMatch = body.match(/in ([A-Z][a-z]+(?:\s[A-Z][a-z]+)*),/);
        if (cityOnlyMatch) {
          city = cityOnlyMatch[1];
        }
      }
    }

    // ── 3. 提取国家（补充提取，如果步骤2已经提取到则跳过）────────────────
    if (!country || country === "Unknown") {
      const countryPatterns = [
        /I live in ([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/,
        /from ([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/,
      ];
      for (const pattern of countryPatterns) {
        const match = body.match(pattern);
        if (match && !["I", "This", "My", "Hello", "Hi"].includes(match[1])) {
          // 如果已识别出城市且匹配到城市名，跳过（避免重复）
          const candidate = match[1];
          if (!city || city === "Unknown" || candidate !== city) {
            country = candidate;
          }
          break;
        }
      }
    }

    // ── 4. 提取兴趣 ────────────────────────────────────────────────────────
    let interests: string[] = [];
    if (email.recipientInterests) {
      try {
        interests =
          typeof email.recipientInterests === "string"
            ? JSON.parse(email.recipientInterests)
            : email.recipientInterests;
      } catch {
        interests = [email.recipientInterests];
      }
    } else {
      // 关键词直接检测（覆盖 "Music is my passion"、"Sports and gaming are my hobbies" 等句式）
      const keywordMap: Record<string, RegExp> = {
        reading: /\b(?:reading|books?|literature)\b/i,
        music: /\b(?:music|musical|musician|singing)\b/i,
        travel: /\b(?:travel(?:ing|ler)?|travelling|journey|explore)\b/i,
        photography: /\b(?:photograph(?:y|er|ing)|camera|photos?)\b/i,
        sports: /\b(?:sports?|athletics|fitness|gym|exercise)\b/i,
        gaming: /\b(?:gaming|gamer|video games?|games?)\b/i,
      };
      for (const [interest, pattern] of Object.entries(keywordMap)) {
        if (pattern.test(body)) {
          interests.push(interest);
        }
      }

      // 如果关键词没匹配到，再尝试句式提取
      if (interests.length === 0) {
        const sentencePatterns = [
          /I enjoy ([^.]+)/i,
          /I like ([^.]+)/i,
          /my hobbies are ([^.]+)/i,
          /love ([^.]+)/i,
        ];
        for (const pattern of sentencePatterns) {
          const match = body.match(pattern);
          if (match) {
            const extracted = match[1]
              .split(/,|\s+and\s+/)
              .map((i: string) => i.trim().toLowerCase())
              .filter((i: string) => i && i.length > 1);
            interests.push(...extracted);
            break;
          }
        }
      }

      // 过滤空字符串
      interests = interests.filter((i: string) => i && i.trim().length > 0);
    }

    // 如果没有兴趣，返回默认值 'general'
    if (interests.length === 0) {
      interests = ["general"];
    }

    // ── 5. 提取 Postcrossing 经验 ──────────────────────────────────────────
    let postcrossingExperience = email.postcrossingExperience;
    if (!postcrossingExperience) {
      if (
        body.includes("just joined") ||
        body.includes("new to") ||
        body.includes("first postcard")
      ) {
        postcrossingExperience = "New to Postcrossing";
      } else {
        const expPatterns = [
          /I've been on Postcrossing for (\d+)\s*years?/,
          /on Postcrossing for (\d+)\s*years?/,
        ];
        for (const pattern of expPatterns) {
          const match = body.match(pattern);
          if (match) {
            postcrossingExperience = `I've been on Postcrossing for ${match[1]} years`;
            break;
          }
        }
      }
    }

    // ── 6. 提取个人信息 ────────────────────────────────────────────────────
    const personalInfo: Record<string, string> = {
      ...(email.personalInfo || {}),
    };

    // 年龄
    if (!personalInfo.age) {
      const ageMatch = body.match(/I am (\d+)\s*years?\s*old/i);
      if (ageMatch) {
        personalInfo.age = ageMatch[1];
      }
    }

    // 职业：work as a <occupation> [in/at ...]（终止于句号或行末）
    if (!personalInfo.occupation) {
      const occupationMatch = body.match(/work as (?:a |an )?([^.]+)/i);
      if (occupationMatch) {
        personalInfo.occupation = occupationMatch[1].trim();
      }
    }

    // 音乐偏好：listening to <music> 或 favorite music is <music>
    if (!personalInfo.favoriteMusic) {
      const musicPatterns = [
        /(?:listening to|like listening to)\s+([^.]+)/i,
        /favorite music is ([^.]+)/i,
        /love(?:s)? listening to ([^.]+)/i,
      ];
      for (const pattern of musicPatterns) {
        const match = body.match(pattern);
        if (match) {
          personalInfo.favoriteMusic = match[1].trim();
          break;
        }
      }
    }

    return {
      recipientName: recipientName || "Unknown",
      country: country || "Unknown",
      city: city || "Unknown",
      interests,
      postcrossingExperience,
      personalInfo,
      recipientAge: email.recipientAge,
      recipientGender: email.recipientGender,
    };
  }

  /**
   * 获取所有收件人列表
   */
  async getRecipientsList(options?: {
    country?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};

    if (options?.country) {
      where.recipientCountry = options.country;
    }

    if (options?.status) {
      where.status = options.status;
    }

    const [postcards, total] = await Promise.all([
      prisma.postcard.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: options?.limit || 20,
        skip: options?.offset || 0,
        include: {
          email: {
            select: {
              subject: true,
              receivedAt: true,
            },
          },
        },
      }),
      prisma.postcard.count({ where }),
    ]);

    return {
      postcards,
      total,
      hasMore: (options?.offset || 0) + (options?.limit || 20) < total,
    };
  }

  /**
   * 获取统计摘要
   */
  async getStatsSummary() {
    const [totalPostcards, statusDistribution, recentPostcards] =
      await Promise.all([
        prisma.postcard.count(),
        prisma.postcard.groupBy({
          by: ["status"],
          _count: true,
        }),
        prisma.postcard.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            recipientName: true,
            recipientCountry: true,
            recipientCity: true,
            status: true,
            createdAt: true,
          },
        }),
      ]);

    return {
      totalPostcards,
      statusDistribution: statusDistribution.reduce(
        (acc, item) => {
          acc[item.status] = item._count;
          return acc;
        },
        {} as Record<string, number>,
      ),
      recentPostcards,
    };
  }

  /**
   * 批量分析邮件
   */
  async analyzeEmails(emails: any[]): Promise<Map<string, any>> {
    const results = new Map<string, any>();

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      const analysis = await this.analyzeEmail(email);

      // Use postcardId as key for unique postcardIds, fallback to index-based key
      const key =
        email.postcardId || (email.id ? `${email.id}_${i}` : String(i));
      results.set(key, analysis);
    }

    return results;
  }

  /**
   * 调用 AI API 进行分析（使用 OpenAI SDK 连接阿里云百炼）
   */
  private async callAI(prompt: string): Promise<string> {
    // 从数据库动态获取 AI 配置并创建客户端
    const aiConfig = await getConfigForPurpose('text');
    const openai = await createOpenAIWithProxy(aiConfig);

    const completion = await openai.chat.completions.create({
      model: aiConfig.model,
      messages: [
        {
          role: "system",
          content:
            "You are a Postcrossing expert assistant. Analyze the user profile and provide insights for writing personalized postcards. Respond in JSON format.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    return completion.choices[0]?.message?.content || "";
  }

  /**
   * 分析收件人数据（从 Postcard 或其他来源）
   * 用于粘贴用户场景，直接分析已解析的收件人信息
   * 返回用户期望的字段格式
   * 使用 AI API 进行智能分析
   */
  async analyzeRecipientData(data: {
    recipientName?: string;
    country?: string;
    city?: string;
    address?: string | null;
    bio?: string | null;
    interests?: string[];
    age?: number | null;
    gender?: string | null;
  }) {
    // 构建 AI 分析提示词（同时生成英文和中文）
    const aiPrompt = `
Analyze this Postcrossing user profile and provide insights for writing a personalized postcard.

User Profile:
- Name: ${data.recipientName || "Unknown"}
- Country: ${data.country || "Unknown"}
- City: ${data.city || "Unknown"}
- Bio: ${data.bio || "Not provided"}
- Interests: ${data.interests?.join(", ") || "Not specified"}
- Age: ${data.age || "Unknown"}
- Gender: ${data.gender || "Unknown"}

Please analyze and respond in JSON format with BOTH English and Chinese translations:

{
  "cardPreference": {
    "en": "What type of postcard they would like",
    "zh": "他们喜欢的明信片类型"
  },
  "contentPreference": {
    "en": "What content topics they'd enjoy reading about",
    "zh": "他们喜欢阅读的内容话题"
  },
  "languagePreference": {
    "en": "Preferred language for the message",
    "zh": "消息首选语言"
  },
  "specialRequests": {
    "en": "Any specific preferences or requests from their bio",
    "zh": "个人简介中的特殊偏好或请求"
  },
  "personalHighlights": {
    "en": "Key personal details to mention",
    "zh": "需要提及的关键个人细节"
  },
  "postcrossingExperience": {
    "en": "How experienced they are with Postcrossing",
    "zh": "他们的Postcrossing经验"
  },
  "interests": ["list of interests extracted"],
  "personality": {
    "en": "Brief personality description in English",
    "zh": "简要的性格描述（中文）"
  },
  "writingStyle": {
    "en": "Recommended writing style in English",
    "zh": "推荐的写作风格（中文）"
  },
  "suggestedTopics": {
    "en": ["topics to write about in English"],
    "zh": ["可以撰写的话题（中文）"]
  }
}
`;

    try {
      const aiResponse = await this.callAI(aiPrompt);

      // 尝试解析 AI 响应
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // 处理双语格式
        const extractValue = (field: any, lang: "en" | "zh") => {
          if (typeof field === "object" && field !== null) {
            return field[lang] || field["en"] || field;
          }
          return field;
        };

        return {
          // 英文版本
          en: {
            cardPreference: extractValue(parsed.cardPreference, "en") || "any",
            contentPreference:
              extractValue(parsed.contentPreference, "en") || "general",
            languagePreference:
              extractValue(parsed.languagePreference, "en") || "English",
            specialRequests:
              extractValue(parsed.specialRequests, "en") || "none",
            personalHighlights:
              extractValue(parsed.personalHighlights, "en") || "",
            postcrossingExperience:
              extractValue(parsed.postcrossingExperience, "en") || "Unknown",
            personality: extractValue(parsed.personality, "en") || "Friendly",
            writingStyle:
              extractValue(parsed.writingStyle, "en") || "Casual and friendly",
            suggestedTopics: extractValue(parsed.suggestedTopics, "en") || [
              "Daily life",
              "Weather",
            ],
          },
          // 中文版本
          zh: {
            cardPreference:
              extractValue(parsed.cardPreference, "zh") || "任何类型",
            contentPreference:
              extractValue(parsed.contentPreference, "zh") || "一般话题",
            languagePreference:
              extractValue(parsed.languagePreference, "zh") || "英语",
            specialRequests: extractValue(parsed.specialRequests, "zh") || "无",
            personalHighlights:
              extractValue(parsed.personalHighlights, "zh") || "",
            postcrossingExperience:
              extractValue(parsed.postcrossingExperience, "zh") || "未知",
            personality: extractValue(parsed.personality, "zh") || "友好",
            writingStyle: extractValue(parsed.writingStyle, "zh") || "随性友好",
            suggestedTopics: extractValue(parsed.suggestedTopics, "zh") || [
              "日常生活",
              "天气",
            ],
          },
          // 兼容旧格式
          cardPreference: extractValue(parsed.cardPreference, "en") || "any",
          contentPreference:
            extractValue(parsed.contentPreference, "en") || "general",
          languagePreference:
            extractValue(parsed.languagePreference, "en") || "English",
          specialRequests: extractValue(parsed.specialRequests, "en") || "none",
          personalHighlights:
            extractValue(parsed.personalHighlights, "en") || "",
          postcrossingExperience:
            extractValue(parsed.postcrossingExperience, "en") || "Unknown",
          interests: parsed.interests || data.interests || [],
          personality: extractValue(parsed.personality, "en") || "Friendly",
          writingStyle:
            extractValue(parsed.writingStyle, "en") || "Casual and friendly",
          suggestedTopics: extractValue(parsed.suggestedTopics, "en") || [
            "Daily life",
            "Weather",
          ],
        };
      }
    } catch (error) {
      // console.error("AI analysis failed, falling back to rule-based:", error);
    }

    // Fallback: 基于规则的文本匹配（如果 AI 失败）
    const extractedInterests: string[] = data.interests
      ? [...data.interests]
      : [];

    if (data.bio) {
      const bioLower = data.bio.toLowerCase();
      const interestKeywords = [
        "coffee",
        "tea",
        "books",
        "reading",
        "music",
        "art",
        "painting",
        "rocks",
        "hiking",
        "travel",
        "cooking",
        "photography",
        "gardening",
        "pets",
        "dogs",
        "cats",
        "movies",
        "sports",
        "yoga",
        "meditation",
        "history",
        "science",
        "nature",
        "beach",
        "mountain",
        "food",
        "crafts",
      ];

      for (const keyword of interestKeywords) {
        if (
          bioLower.includes(keyword) &&
          !extractedInterests.includes(keyword)
        ) {
          extractedInterests.push(keyword);
        }
      }
    }

    let cardPreference = "any";
    if (data.age) {
      if (data.age < 18) cardPreference = "young/fun";
      else if (data.age > 50) cardPreference = "classic/elegant";
    }

    const contentPreference =
      extractedInterests.length > 0
        ? extractedInterests.slice(0, 5).join(", ")
        : "general";

    const languagePreference = "English";

    let specialRequests = "none";
    if (data.bio) {
      const bioLower = data.bio.toLowerCase();
      if (
        bioLower.includes("prefer") ||
        bioLower.includes("would like") ||
        bioLower.includes("hope")
      ) {
        specialRequests = "Check bio for specific preferences";
      }
    }

    const personalHighlights =
      extractedInterests.length > 0
        ? extractedInterests.slice(0, 5).join(", ")
        : "General interest in postcards";

    let postcrossingExperience = "Unknown";
    if (data.bio) {
      const sentMatch = data.bio.match(/sent\s*(\d+)/i);
      const receivedMatch = data.bio.match(/received\s*(\d+)/i);
      if (sentMatch || receivedMatch) {
        const sent = sentMatch ? sentMatch[1] : "?";
        const received = receivedMatch ? receivedMatch[1] : "?";
        postcrossingExperience = `Sent ${sent} / Received ${received}`;
      }
    }

    // 返回双语格式
    return {
      en: {
        cardPreference,
        contentPreference,
        languagePreference,
        specialRequests,
        personalHighlights,
        postcrossingExperience,
        personality: "Friendly postcard collector",
        writingStyle: "Casual and friendly",
        suggestedTopics:
          extractedInterests.length > 0
            ? extractedInterests.map((i) => `${i} in their country`)
            : ["Daily life", "Weather", "Postcard stories"],
      },
      zh: {
        cardPreference:
          cardPreference === "young/fun"
            ? "年轻有趣"
            : cardPreference === "classic/elegant"
              ? "经典优雅"
              : "任何类型",
        contentPreference:
          extractedInterests.length > 0
            ? extractedInterests.slice(0, 5).join("、")
            : "一般话题",
        languagePreference: "英语",
        specialRequests:
          specialRequests === "Check bio for specific preferences"
            ? "查看简介了解特殊偏好"
            : "无",
        personalHighlights:
          extractedInterests.length > 0
            ? extractedInterests.slice(0, 5).join("、")
            : "对明信片的兴趣",
        postcrossingExperience:
          postcrossingExperience === "Unknown"
            ? "未知"
            : postcrossingExperience,
        personality: "友好的明信片收藏家",
        writingStyle: "随性友好",
        suggestedTopics:
          extractedInterests.length > 0
            ? extractedInterests.map((i) => `他们国家的${i}`)
            : ["日常生活", "天气", "明信片故事"],
      },
      // 兼容旧格式
      cardPreference,
      contentPreference,
      languagePreference,
      specialRequests,
      personalHighlights,
      postcrossingExperience,
      interests: extractedInterests,
      personality: "Friendly postcard collector",
      writingStyle: "Casual and friendly",
      suggestedTopics:
        extractedInterests.length > 0
          ? extractedInterests.map((i) => `${i} in their country`)
          : ["Daily life", "Weather", "Postcard stories"],
    };
  }
}

// 导出服务实例
export const analysisService = new AnalysisService();
