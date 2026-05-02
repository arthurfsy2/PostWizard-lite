import { prisma } from "../prisma";
import { getAIConfigFromDB } from "./ai-config";

export interface GenerationOptions {
  language?: string;
  tone?: string;
  includeWeather?: boolean;
  includeLocalNews?: boolean;
  includePersonalStory?: boolean;
  wordCount?: number;
  isHandwritten?: boolean;
  extraInfo?: {
    languages?: string;
    avatarUrl?: string;
    favoritePostcards?: string[];
    senderCoordinates?: { lat: number; lng: number };
    receiverCoordinates?: { lat: number; lng: number };
    sentDate?: string;
    pronouns?: string;
    birthday?: string;
    aboutText?: string;
  };
}

export interface MatchedMaterial {
  category: string; // 分类：兴趣爱好、旅行故事等
  content: string; // 素材内容摘要
  matchedKeyword: string; // 匹配的关键词
}

export interface GenerationResult {
  id: string;
  contentTitle: string;
  contentEn: string; // 英文版（主要）
  contentZh: string; // 中文版（辅助）
  contentBody: string; // 兼容旧版（英文版）
  contentType: string;
  tone?: string;
  postcardId: string;
  usedTokens: number;
  matchedMaterials: MatchedMaterial[]; // 匹配的素材列表
}

export interface AnalysisResult {
  recipientName: string;
  country: string;
  city: string;
  interests: string[];
  postcrossingExperience?: string;
  personalInfo?: {
    hobbies?: string[];
    age?: string;
    occupation?: string;
  };
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}

export interface PostcardContent {
  postcardId: string;
  recipientName: string;
  country: string;
  city: string;
  senderCity: string;
  greeting: string;
  body: string;
  closing: string;
  weather: string;
  localCulture: string;
  personalTouch: string;
}

/**
 * 明信片内容生成服务类
 */
export class GenerationService {
  private senderCity: string = "Shenzhen";

  // 多样化问候语
  private greetings: string[] = [
    "Dear {name},",
    "Hello {name},",
    "Hi {name},",
    "Greetings {name},",
  ];

  // 多样化结束语
  private closings: string[] = [
    "Best wishes from China!",
    "Warm regards from China!",
    "With love from China!",
    "Cheers from China!",
    "Kind regards from China!",
  ];

  /**
   * 设置寄信城市
   */
  setSenderCity(city: string) {
    this.senderCity = city;
  }

  /**
   * 随机选择问候语
   */
  private getRandomGreeting(name: string): string {
    const template =
      this.greetings[Math.floor(Math.random() * this.greetings.length)];
    return template.replace("{name}", name);
  }

  /**
   * 随机选择结束语
   */
  private getRandomClosing(): string {
    return this.closings[Math.floor(Math.random() * this.closings.length)];
  }

  /**
   * 检测是否是 Postcrossing 爱好者
   */
  private isPostcrossingEnthusiast(experience?: string): boolean {
    if (!experience) return false;
    const keywords = [
      "enthusiast",
      "collector",
      "love postcrossing",
      "years",
      "fellow",
    ];
    return keywords.some((keyword) =>
      experience.toLowerCase().includes(keyword),
    );
  }

  /**
   * 检测是否是新成员
   */
  private isNewMember(experience?: string): boolean {
    if (!experience) return false;
    const keywords = [
      "new to postcrossing",
      "just joined",
      "first postcard",
      "beginner",
      "started recently",
    ];
    return keywords.some((keyword) =>
      experience.toLowerCase().includes(keyword),
    );
  }

  /**
   * 从分析结果生成明信片内容
   */
  private generateContentFromAnalysis(
    analysis: AnalysisResult,
    postcardId: string,
  ): PostcardContent {
    // 随机问候语
    const greeting = this.getRandomGreeting(analysis.recipientName);

    // 安全获取兴趣列表（处理 undefined 情况）
    const interests =
      analysis.interests && analysis.interests.length > 0
        ? analysis.interests
        : [];
    const interestsText =
      interests.length > 0
        ? interests.join(", ")
        : "various interesting things";

    // 根据经验定制消息
    let experienceNote = "";
    if (this.isPostcrossingEnthusiast(analysis.postcrossingExperience)) {
      experienceNote = `As a fellow Postcrossing enthusiast, I'm always excited to connect with experienced members like you! I also love ${interestsText}.`;
    } else if (this.isNewMember(analysis.postcrossingExperience)) {
      experienceNote = `Welcome to the Postcrossing community! I'm so happy to be one of your first postcards! I noticed you enjoy ${interestsText}.`;
    } else {
      // 总是提及兴趣（如果存在）
      if (interests.length > 0) {
        experienceNote = `I noticed you're interested in ${interestsText}. That's wonderful! I'd love to hear more about your hobbies.`;
      } else {
        experienceNote = `I'd love to learn more about what you enjoy doing in your free time.`;
      }
    }

    // 根据自定义城市调整
    const senderCity = this.senderCity || "Shenzhen";
    const body = `Hello from ${senderCity}, China! ${experienceNote} I'd love to hear more about your life in ${analysis.city}, ${analysis.country}.`;

    // 随机结束语
    const closing = this.getRandomClosing();

    const weather = `It's sunny and warm here today, perfect weather for writing postcards!`;

    const localCulture = `${senderCity} is a modern coastal city in southern China, known for its innovation and technology.`;

    const personalTouch = `I hope this postcard brings you joy and reminds you that someone far away is thinking of you.`;

    return {
      postcardId,
      recipientName: analysis.recipientName,
      country: analysis.country,
      city: analysis.city,
      senderCity,
      greeting,
      body,
      closing,
      weather,
      localCulture,
      personalTouch,
    };
  }

  /**
   * 生成明信片内容（基于分析结果）
   */
  async generatePostcard(
    analysis: AnalysisResult,
    postcardId: string,
  ): Promise<PostcardContent> {
    return this.generateContentFromAnalysis(analysis, postcardId);
  }

  /**
   * 调用 Claude API 生成内容（基于 postcardId）
   * 注意：实际使用时需要安装 @anthropic-ai/sdk 并配置 API KEY
   */
  async generatePostcardById(
    postcardId: string,
    userId: string,
    options: GenerationOptions = {},
  ): Promise<GenerationResult> {
    return this.generateContentWithClaude(postcardId, userId, options);
  }

  /**
   * 从数据库获取 AI 配置（使用统一工具）
   */
  private async getAIConfig() {
    return getAIConfigFromDB();
  }

  private async generateContentWithClaude(
    postcardId: string,
    currentUserId: string,
    options: GenerationOptions = {},
  ): Promise<GenerationResult> {
    const postcard = await prisma.postcard.findUnique({
      where: { id: postcardId },
    });

    if (!postcard) {
      throw new Error("明信片不存在");
    }

    // 查询用户个人要素（使用当前登录用户的 ID，而不是明信片创建者的 ID）
    // 这样可以确保每个用户都使用自己的个人要素，即使明信片是共享的
    let userProfile: any = null;
    let allMaterials: any[] = []; // 所有个人要素
    let matchedMaterials: MatchedMaterial[] = []; // 匹配到收件人兴趣的素材

    if (currentUserId) {
      userProfile = await prisma.userProfile.findUnique({
        where: { userId: currentUserId },
      });

      // 从个人要素构建素材列表
      if (userProfile) {
        allMaterials = this.buildMaterialsFromProfile(userProfile);
        // 匹配素材（用于标记哪些与收件人兴趣相关）
        matchedMaterials = this.matchMaterials(
          allMaterials,
          postcard.coreInterests || postcard.recipientInterests,
        );
      }
    }

    // 强制校验：用户必须填写至少一个个人要素字段
    const hasAboutMe =
      userProfile && (userProfile.aboutMe || userProfile.aboutMeEn);
    const hasCasualNotes = userProfile && userProfile.casualNotes;
    const hasTags = userProfile && userProfile.tags;

    if (!hasAboutMe && !hasCasualNotes && !hasTags) {
      throw new Error(
        "您尚未填写个人要素，无法生成内容。请先前往 /profile 页面填写个人简介、随心记或兴趣标签，让明信片内容更个性化、更有温度。",
      );
    }

    // 构建提示词（传递所有素材，而不仅是匹配的）
    const prompt = this.buildGenerationPrompt(
      postcard,
      options,
      allMaterials,
      matchedMaterials,
    );

    // 从数据库获取 AI 配置
    const aiConfig = await this.getAIConfig();

    if (!aiConfig.apiKey) {
      throw new Error("AI API Key 未配置，请在后台设置");
    }

    // ========== 开发环境调试日志 ==========
    const isDev = process.env.NODE_ENV === "development";
    if (isDev) {
      console.log("\n========== AI 生成请求调试信息 ==========");
      console.log("API URL:", aiConfig.baseUrl + "/chat/completions");
      console.log("Model:", aiConfig.model);
      console.log(
        "API Key (前10位):",
        aiConfig.apiKey.substring(0, 10) + "...",
      );
      console.log("\n---------- Prompt (提示词) ----------");
      console.log(prompt);
      console.log("---------- Prompt End ----------\n");
      console.log("个人要素数量:", allMaterials.length);
      console.log("匹配到收件人兴趣的素材:", matchedMaterials.length);
      if (allMaterials.length > 0) {
        console.log("要素详情:");
        allMaterials.forEach((m, i) => {
          console.log(
            `  ${i + 1}. [${m.category}] 来源:${m.source || "unknown"} | ${m.content.substring(0, 60)}...`,
          );
        });
      }
      // console.log('==========================================\n');
    }
    // =====================================

    let contentEn: string;
    let contentZh: string;
    let usedTokens: number;

    try {
      const response = await fetch(aiConfig.baseUrl + "/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${aiConfig.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: aiConfig.model,
          messages: [
            {
              role: "system",
              content:
                "你是一位专业的 Postcrossing 明信片收、寄信助手。你的任务是生成友好、真诚、个性化的英文明信片内容。内容要自然流畅，避免模板化。",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          max_tokens: options.wordCount
            ? Math.min(options.wordCount * 2, 1500)
            : 800,
          temperature: 0.8,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `百炼 API 错误: ${errorData.error?.message || response.statusText}`,
        );
      }

      const data = await response.json();
      const generatedText = data.choices?.[0]?.message?.content || "";

      // 解析 JSON 格式输出
      try {
        // 尝试提取 JSON 部分
        const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          contentEn = parsed.en || generatedText;
          contentZh = parsed.zh || "";
        } else {
          contentEn = generatedText;
          contentZh = "";
        }
      } catch (e) {
        contentEn = generatedText;
        contentZh = "";
      }

      // 如果 AI 没有返回中文翻译，自动调用翻译接口
      if (!contentZh || contentZh.trim() === "") {
        // console.log('[中文翻译] AI 未返回中文，自动调用翻译接口...');
        contentZh = await this.translateToChinese(contentEn);
      }

      usedTokens = data.usage?.total_tokens || Math.ceil(contentEn.length / 4);

      // 开发环境：打印 AI 响应
      if (isDev) {
        // console.log('\n========== AI 响应调试信息 ==========');
        // console.log('Used Tokens:', usedTokens);
        // console.log('\n---------- AI 原始返回 ----------');
        // console.log(generatedText);
        // console.log('\n---------- 生成的英文内容 ----------');
        // console.log(contentEn);
        // console.log('\n---------- 生成的中文内容 ----------');
        // console.log(contentZh || '(无中文翻译)');
        // console.log('======================================\n');
      }
    } catch (error: any) {
      // console.error('调用百炼 API 失败:', error);
      // 降级到模拟内容
      const mockResult = this.generateMockContent(
        postcard,
        options,
        matchedMaterials,
      );
      contentEn = mockResult.contentEn;
      contentZh = mockResult.contentZh;
      usedTokens = contentEn.length / 4;
    }

    // 检查是否已存在相同的 postcardId、tone 和当前用户 ID 的记录
    const existingContent = await prisma.sentCardContent.findFirst({
      where: {
        postcardId,
        userId: currentUserId,
        tone: options.tone || 'friendly',
      },
    });

    let generatedContent;
    if (existingContent) {
      // 更新现有记录
      generatedContent = await prisma.sentCardContent.update({
        where: { id: existingContent.id },
        data: {
          content: contentEn,
          contentTitle: `Postcard for ${postcard.recipientName}`,
          contentBody: contentEn,
          contentZh: contentZh || null, // 保存中文翻译
          tone: options.tone,
          isHandwritten: options.isHandwritten || false,
          usedTokens: Math.ceil(usedTokens),
        },
      });
    } else {
      // 创建新记录
      generatedContent = await prisma.sentCardContent.create({
        data: {
          postcardId,
          userId: currentUserId, // 使用当前用户 ID
          type: "postcard_content",
          content: contentEn,
          contentTitle: `Postcard for ${postcard.recipientName}`,
          contentBody: contentEn,
          contentZh: contentZh || null, // 保存中文翻译
          contentType: "full_letter",
          language: "en",
          tone: options.tone,
          isHandwritten: options.isHandwritten || false,
          usedTokens: Math.ceil(usedTokens),
        },
      });
    }

    return {
      id: generatedContent.id,
      contentTitle: generatedContent.contentTitle,
      contentEn,
      contentZh,
      contentBody: contentEn,
      contentType: generatedContent.contentType,
      tone: options.tone,
      postcardId,
      usedTokens: generatedContent.usedTokens || 0,
      matchedMaterials,
    };
  }

  /**
   * 将英文内容翻译成中文
   */
  private async translateToChinese(englishText: string): Promise<string> {
    try {
      const aiConfig = await this.getAIConfig();

      const response = await fetch(aiConfig.baseUrl + "/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${aiConfig.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: aiConfig.model,
          messages: [
            {
              role: "system",
              content:
                "你是一位翻译专家。请将英文明信片内容翻译成自然流畅的中文，保留原文的语气和情感。",
            },
            {
              role: "user",
              content: `请将以下英文明信片内容翻译成中文：\n\n${englishText}`,
            },
          ],
          max_tokens: 1000,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        return "（翻译失败，请参考英文原文）";
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content?.trim() || "（翻译失败）";
    } catch (error) {
      // console.error('翻译失败:', error);
      return "（翻译服务暂时不可用，请参考英文原文）";
    }
  }

  /**
   * 从个人要素构建素材列表
   * 将 UserProfile 数据转换为 MatchedMaterial 格式
   *
   * 字段设计：
   * - aboutMe: 个人简介（用户原始输入，可能是中文或英文）
   * - aboutMeEn: 个人简介英文翻译（仅当用户输入中文时存在）
   * - casualNotes: 随心记（用户输入的中文）
   * - tags: AI识别的标签列表
   *
   * Prompt 使用逻辑：
   * - aboutMeEn 存在 → 使用 aboutMeEn
   * - 否则 → 使用 aboutMe
   * - casualNotes → 直接使用
   */
  private buildMaterialsFromProfile(profile: any): any[] {
    const materials: any[] = [];

    // 1. 个人简介 - 优先使用翻译后的英文 aboutMeEn
    const aboutMeContent =
      profile.aboutMeEn && profile.aboutMeEn.trim()
        ? profile.aboutMeEn.trim()
        : profile.aboutMe
          ? profile.aboutMe.trim()
          : "";

    if (aboutMeContent) {
      const source =
        profile.aboutMeEn && profile.aboutMeEn.trim() ? "aboutMeEn" : "aboutMe";
      materials.push({
        category: "个人简介",
        content: aboutMeContent,
        source,
        description: "个人简介（英文）",
      });
    }

    // 2. 随心记 - 中文原文（用户输入）
    if (profile.casualNotes && profile.casualNotes.trim()) {
      const notes = profile.casualNotes
        .split(/\n\n+/)
        .map((n: string) => n.trim())
        .filter((n: string) => n.length > 5);

      if (notes.length > 0) {
        materials.push({
          category: "故事素材",
          content: notes.join("\n\n---\n\n"),
          source: "casualNotes",
          description: "随心记（中文原文）",
        });
      }
    }

    // 3. 标签 - 兴趣关键词
    if (profile.tags) {
      try {
        const tags =
          typeof profile.tags === "string"
            ? JSON.parse(profile.tags)
            : profile.tags;
        if (Array.isArray(tags) && tags.length > 0) {
          materials.push({
            category: "兴趣标签",
            content: tags.join(", "),
            description: "AI 识别的兴趣关键词",
          });
        }
      } catch (e) {
        // 忽略解析错误
      }
    }

    return materials;
  }

  /**
   * 匹配用户素材与收件人兴趣
   */
  private matchMaterials(
    userMaterials: any[],
    recipientInterests?: string | null,
  ): MatchedMaterial[] {
    const matched: MatchedMaterial[] = [];

    if (!recipientInterests || !userMaterials.length) {
      return matched;
    }

    // 将收件人兴趣转换为关键词数组
    const interestKeywords = recipientInterests
      .toLowerCase()
      .split(/[,，、\s]+/)
      .filter(Boolean);

    // 分类映射（适配新的 Profile 结构）
    const categoryMap: Record<string, string> = {
      self_intro: "自我介绍",
      hobbies: "兴趣爱好",
      hometown: "家乡介绍",
      travel_stories: "旅行故事",
      fun_facts: "有趣故事",
      about_me: "个人简介",
      casual_notes: "随心记",
      interests: "兴趣标签",
      个人简介: "个人简介",
      故事素材: "故事素材",
      兴趣标签: "兴趣标签",
    };

    for (const material of userMaterials) {
      const content = material.content?.toLowerCase() || "";
      const categoryZh = categoryMap[material.category] || material.category;

      // 检查素材内容是否匹配任何兴趣关键词
      for (const keyword of interestKeywords) {
        if (content.includes(keyword)) {
          matched.push({
            category: categoryZh,
            content: material.content, // 使用完整内容，不截断
            matchedKeyword: keyword,
          });
          break; // 每个素材只匹配一次
        }
      }
    }

    return matched;
  }

  /**
   * 公开方法：构建指定版本的 prompt（供测试脚本使用）
   */
  buildPromptForVersion(
    postcard: any,
    options: GenerationOptions,
    allMaterials: any[] = [],
    matchedMaterials: MatchedMaterial[] = [],
    version: 'v1' | 'v2' = 'v2',
  ): string {
    return this.buildGenerationPrompt(postcard, options, allMaterials, matchedMaterials, version);
  }

  /**
   * 公开方法：从 userProfile 构建素材列表（供测试脚本使用）
   */
  buildMaterials(profile: any): any[] {
    return this.buildMaterialsFromProfile(profile);
  }

  /**
   * 公开方法：匹配素材与收件人兴趣（供测试脚本使用）
   */
  matchMaterialsForTest(materials: any[], recipientInterests: string | null): MatchedMaterial[] {
    return this.matchMaterials(materials, recipientInterests);
  }

  /**
   * 构建生成提示词
   * @param allMaterials 所有个人要素（始终显示）
   * @param matchedMaterials 与收件人兴趣匹配的要素（用于标记）
   * @param version prompt 版本：v1=baseline, v2=optimized（默认 v2）
   */
  private buildGenerationPrompt(
    postcard: any,
    options: GenerationOptions,
    allMaterials: any[] = [],
    matchedMaterials: MatchedMaterial[] = [],
    version: 'v1' | 'v2' = 'v2',
  ): string {
    if (version === 'v1') {
      return this.buildPromptV1(postcard, options, allMaterials, matchedMaterials);
    }
    return this.buildPromptV2(postcard, options, allMaterials, matchedMaterials);
  }

  /**
   * Prompt v1: baseline 版本（原始 prompt）
   */
  private buildPromptV1(
    postcard: any,
    options: GenerationOptions,
    allMaterials: any[] = [],
    matchedMaterials: MatchedMaterial[] = [],
  ): string {
    // 获取当前日期
    const now = new Date();
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const month = monthNames[now.getMonth()];
    const day = now.getDate();
    const year = now.getFullYear();

    const parts: string[] = [];

    parts.push(`你是一位专业的 Postcrossing 明信片收、寄信助手。请根据以下信息，生成一封符合要求的英文明信片内容。

## ⚠️ 核心约束（必须遵守）

### 1. 内容真实性原则（不可违反）
- **所有内容必须基于以下"我的个人素材"中明确写出的事实**
- **严禁编造**任何未经确认的经历、职业、所在地、物品或故事
- **严禁举例说明**：不要列举具体例子（如"喜欢动物，比如熊猫和老虎"），除非素材中明确列出了这些例子
- 如果不确定某个信息，宁可不写，也不要编造或过度具体化

### 2. 格式要求（必须遵守）
- **字数**：英文部分严格控制在 **90-120 词**，这是硬性上限，超出将被拒绝
- **开头格式**：${month} ${day}, ${year} {temp}°C {weather_emoji}
  - temp 和 weather_emoji 请根据合理天气填写（如 25°C ☀️）
- **语言**：英文，每封下方附中文对照翻译
- **素材使用**：从个人要素中**提取多处细节**充实各段落（自我介绍、兴趣分享等），用自己的话自然转述，不要大段复制粘贴素材原文

### 3. 结构要求（必须遵守）
按以下顺序组织内容：
1. 日期行（格式如上）
2. 简短问候（1-2句）
3. 简短自我介绍（只能使用素材中的真实信息）
4. 针对收件人兴趣的回应（结合素材）
5. 简短祝愿（1句）
6. 签名

## 收件人信息
- **姓名**: ${postcard.recipientName}
- **国家**: ${postcard.recipientCountry}
- **城市**: ${postcard.recipientCity}
${postcard.recipientAge ? `- **年龄**: ${postcard.recipientAge}` : ""}
${(postcard.coreInterests || postcard.recipientInterests) ? `- **兴趣爱好**: ${postcard.coreInterests || postcard.recipientInterests}` : ""}
${postcard.recipientBio ? `- **个人介绍**: ${postcard.recipientBio}` : ""}
${options.extraInfo?.languages ? `- **语言能力**: ${options.extraInfo.languages}` : ""}
${options.extraInfo?.pronouns ? `- **代词**: ${options.extraInfo.pronouns}` : ""}
${options.extraInfo?.birthday ? `- **生日**: ${options.extraInfo.birthday}` : ""}
${options.extraInfo?.sentDate ? `- **发送日期**: ${options.extraInfo.sentDate}` : ""}
${options.extraInfo?.aboutText ? `\n## 收件人原文简介:\n${options.extraInfo.aboutText.substring(0, 500)}${options.extraInfo.aboutText.length > 500 ? "...(已截断)" : ""}` : ""}

## 我的个人要素（只能使用以下事实，严禁编造）

### 📋 要素使用指南
1. **个人简介**（来源：个人简介输入框）- 核心自我介绍，优先在开头部分使用
2. **故事素材**（来源：随心记）- 随心记的英文翻译，个人故事、经历分享
3. **兴趣标签** - AI 识别的兴趣关键词，用于匹配收件人兴趣

`);

    // 构建匹配关键词集合，用于标记
    const matchedKeywords = new Set(
      matchedMaterials
        .map((m) => m.matchedKeyword?.toLowerCase())
        .filter(Boolean),
    );

    if (allMaterials.length > 0) {
      allMaterials.forEach((material, index) => {
        const categoryZh = material.category || "素材";

        // 检查这个素材是否匹配了收件人兴趣
        const contentLower = material.content?.toLowerCase() || "";
        const isMatched =
          matchedKeywords.size > 0 &&
          Array.from(matchedKeywords).some((kw) => contentLower.includes(kw));

        // 根据类型选择展示格式
        if (categoryZh === "兴趣标签") {
          parts.push(`\n【${categoryZh}】关键词：${material.content}`);
        } else {
          const matchMarker = isMatched ? " ✅ 匹配收件人兴趣" : "";
          parts.push(
            `\n========== ${index + 1}. 【${categoryZh}】${matchMarker} ==========\n${material.content}\n`,
          );
        }
      });

      if (matchedMaterials.length > 0) {
        parts.push(
          `\n💡 **匹配提示**：以上标记 ✅ 的素材可能与收件人兴趣相关，如确实相关可优先使用。`,
        );
      }

      parts.push(
        "\n\n⚠️ **核心约束**：\n" +
          "- 只能从上述要素中提取事实写入明信片\n" +
          "- 不能编造、扩展或添加细节\n" +
          "- 根据收件人兴趣选择性使用匹配的故事素材\n" +
          "- 个人简介用于开场自我介绍\n" +
          "- 故事素材用于回应收件人兴趣或分享经历",
      );
    } else {
      parts.push("\n📝 暂无个人要素，请只写简短问候和祝愿，不要编造个人信息。");
    }

    parts.push(`

## 语气风格
${options.tone === "formal" ? "- 正式、礼貌" : options.tone === "casual" ? "- 轻松、随意" : "- 友好、温暖、真诚"}
- 简洁自然，像真实朋友写的
- 避免模板化套话（如 "I noticed from your profile...", "That's wonderful!"）

## 输出格式
请输出 JSON 格式（英文部分必须 90-120 词，数清楚再输出）：
{
  "en": "Apr 16, 2026 25°C ☀️\\n\\nHi Name,\\n\\n...(正文)...\\n\\nBest,\\nMy Name",
  "zh": "中文翻译"
}

⚠️ 再次强调：英文部分 90-120 词，多一个词都不行。如果素材太长，只提炼关键信息，不要照抄。

## ❌ 错误示例（不要这样写）

**素材**: "My daughter just turned 3 and loves animals"

**错误输出**: "...my daughter just turned 3 and loves animals like marmots and quokkas..."

**错误原因**:
- 素材只说"喜欢动物"，没有提到具体喜欢什么动物
- AI 自行添加了"土拨鼠和短尾矮袋鼠"作为例子
- 这是不合理的具体化，除非素材明确说"喜欢土拨鼠和短尾矮袋鼠"

**正确写法**: "...my daughter just turned 3 and loves animals..."（保持原样，不添加具体例子）

---

## ✅ 正确示例（符合要求的输出）

**素材**: "I'm a software developer who loves weekend photography walks"

**正确输出**:
{
  "en": "Jul 15, 2024 26°C ☀️\\n\\nHi Tijn,\\n\\nGreetings from Shenzhen! I'm a software developer who loves weekend photography walks. Noticed your passion for vintage cars - there's something special about their timeless design.\\n\\nWish you great finds at your next flea market!\\n\\nBest,\\nPostWizard User",
  "zh": "2024年7月15日 26°C ☀️\\n\\n你好 Tijn，\\n\\n来自深圳的问候！我是一名软件开发者，喜欢周末摄影散步。注意到你对复古车的热爱——它们永恒的设计确实有独特魅力。\\n\\n祝你在下次跳蚤市场找到好宝贝！\\n\\n此致，\\nPostWizard User"
}

**为什么正确**: 
- "software developer" 和 "photography walks" 都是素材中明确的事实
- 没有添加素材中没有的具体细节`);

    return parts.join("");
  }

  /**
   * Prompt v2: 优化版 — 强化字数、深化兴趣回应、增加对话感
   */
  private buildPromptV2(
    postcard: any,
    options: GenerationOptions,
    allMaterials: any[] = [],
    matchedMaterials: MatchedMaterial[] = [],
  ): string {
    const now = new Date();
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const month = monthNames[now.getMonth()];
    const day = now.getDate();
    const year = now.getFullYear();

    const parts: string[] = [];

    parts.push(`你是一位专业的 Postcrossing 明信片收、寄信助手。请根据以下信息，生成一封"走心"的英文明信片内容——像一个真实的朋友在写信，而不是在填模板。

## ⚠️ 核心约束（必须遵守）

### 1. 内容真实性原则（不可违反）
- **所有内容必须基于以下"我的个人素材"中明确写出的事实**
- **严禁编造**任何未经确认的经历、职业、所在地、物品或故事
- **严禁举例说明**：不要列举具体例子（如"喜欢动物，比如熊猫和老虎"），除非素材中明确列出了这些例子
- 如果不确定某个信息，宁可不写，也不要编造或过度具体化

### 1.5 素材丰富度要求（非常重要）
- 你的素材库中有**多个维度的信息**（个人简介、故事素材、兴趣标签等）
- **每封信必须使用至少 3 个不同的素材细节**，不要每次都只用相同的 1-2 个
- 从故事素材（随心记）中选取一个有趣的故事或经历融入信中——这是让内容"走心"的关键
- 不同的收件人应该让你选择不同的素材组合，而不是千篇一律

### 2. 字数要求（硬性约束）
- **英文正文（不含日期行和签名）必须在 90-120 词之间**
- ⚠️ **不足 90 词的输出将被拒绝**——你有丰富的个人素材可用，请充分利用它们充实每个段落
- ⚠️ **超出 120 词的输出将被拒绝**——如果素材太长，选择最相关的细节
- **写满 90 词的方法**：在自我介绍中多用 1-2 个素材细节，在兴趣分享中多写一句个人感受
- **建议分布**：自我介绍 30-40 词 + 兴趣回应 40-50 词 + 祝愿 10-15 词
- **字数不足时**：在自我介绍中多加一句个人感受（如"每天骑车是我最放松的时刻"），在兴趣回应中多加一句好奇的延伸（如"我一直想了解这项运动的入门门槛"）

### 3. 结构要求（必须遵守，每段有最少句数要求）
按以下顺序组织内容：
1. **日期行**：${month} ${day}, ${year} {temp}°C {weather_emoji}
   - temp 和 weather_emoji 请根据合理天气填写（如 25°C ☀️）
2. **问候**（1-2 句）：用收件人的名字打招呼
3. **自我介绍**（2-3 句）：来自哪里、做什么的、一个有趣的细节（只能用素材事实）
4. **兴趣回应 + 个人分享**（3-5 句，全文最重要的部分）：
   - **情况 A：素材与收件人兴趣有真实关联** → 自然地建立连接，分享相关经历
   - **情况 B：素材与收件人兴趣没有关联** → **不要编造连接！** 如实分享随心记中的内容，然后真诚地对收件人的兴趣表示好奇
   - 两种情况都必须包含：**至少 1 个开放式问题**
   - 🚫 **严禁编造**：不能说"我对 X 也很感兴趣"或"作为一个 Y，我觉得 Z 很有趣"——除非素材中明确提到
   - ✅ **正确做法**：如果没有关联，就大方地说 "I'd love to hear more about your interest in..." 或 "What got you into...?"
   - 禁止：泛泛的 "That's interesting!" / "I noticed from your profile..." / "That's wonderful!"
5. **祝愿**（1 句）：针对收件人具体情况的真诚祝愿
6. **签名**

### 4. 对话感要求（必须遵守）
- **必须包含至少 1 个开放式问题**（让收件人有话可回，而不是 yes/no 问题）
- 如果收件人 bio 中有情感表达（如热爱某事物、家庭信息），**必须回应这种情感**
- 语气要像朋友间的闲聊，不是百科全书式的陈述
- 语言${options.extraInfo?.languages ? `（收件人懂 ${options.extraInfo.languages}，如果收件人的语言包含中文，可以适当加入一两句中文问候）` : '用英文'}

## 收件人信息
- **姓名**: ${postcard.recipientName}
- **国家**: ${postcard.recipientCountry}
- **城市**: ${postcard.recipientCity}
${postcard.recipientAge ? `- **年龄**: ${postcard.recipientAge}` : ""}
${(postcard.coreInterests || postcard.recipientInterests) ? `- **兴趣爱好**: ${postcard.coreInterests || postcard.recipientInterests}` : ""}
${postcard.recipientBio ? `- **个人介绍**: ${postcard.recipientBio}` : ""}
${options.extraInfo?.languages ? `- **语言能力**: ${options.extraInfo.languages}` : ""}
${options.extraInfo?.pronouns ? `- **代词**: ${options.extraInfo.pronouns}` : ""}
${options.extraInfo?.birthday ? `- **生日**: ${options.extraInfo.birthday}` : ""}
${options.extraInfo?.sentDate ? `- **发送日期**: ${options.extraInfo.sentDate}` : ""}
${options.extraInfo?.aboutText ? `\n## 收件人原文简介:\n${options.extraInfo.aboutText.substring(0, 500)}${options.extraInfo.aboutText.length > 500 ? "...(已截断)" : ""}` : ""}

## 我的个人要素（只能使用以下事实，严禁编造）

### 📋 要素使用指南
1. **个人简介**（来源：个人简介输入框）- 核心自我介绍，优先在开头部分使用
2. **故事素材**（来源：随心记）- 随心记的英文翻译，个人故事、经历分享
3. **兴趣标签** - AI 识别的兴趣关键词，用于匹配收件人兴趣

`);

    // 构建匹配关键词集合，用于标记
    const matchedKeywords = new Set(
      matchedMaterials
        .map((m) => m.matchedKeyword?.toLowerCase())
        .filter(Boolean),
    );

    if (allMaterials.length > 0) {
      allMaterials.forEach((material, index) => {
        const categoryZh = material.category || "素材";
        const contentLower = material.content?.toLowerCase() || "";
        const isMatched =
          matchedKeywords.size > 0 &&
          Array.from(matchedKeywords).some((kw) => contentLower.includes(kw));

        if (categoryZh === "兴趣标签") {
          parts.push(`\n【${categoryZh}】关键词：${material.content}`);
        } else {
          const matchMarker = isMatched ? " ✅ 匹配收件人兴趣" : "";
          parts.push(
            `\n========== ${index + 1}. 【${categoryZh}】${matchMarker} ==========\n${material.content}\n`,
          );
        }
      });

      if (matchedMaterials.length > 0) {
        parts.push(
          `\n💡 **匹配提示**：以上标记 ✅ 的素材与收件人兴趣相关，请优先使用这些素材来建立真实连接。`,
        );
      }

      parts.push(
        "\n\n⚠️ **素材使用约束**：\n" +
          "- 只能从上述要素中提取事实写入明信片\n" +
          "- 不能编造素材中没有的经历、职业或观点\n" +
          "- **可以做**：在素材事实后面添加自己的感受（如\"骑车是我最放松的时刻\"）、表达好奇（如\"我一直想试试射箭\"）、用更生动的语言转述原文\n" +
          "- **不能做**：把两个独立事实拼接成新故事（如素材说\"喜欢动物\"和\"上幼儿园\"，不能编出\"幼儿园的小兔子\"）、添加素材中没有的具体细节\n" +
          "- **鼓励使用多处素材细节**：用你自己的话自然转述，充实自我介绍和兴趣分享\n" +
          "- 匹配的故事素材（✅ 标记）可用于回应收件人兴趣\n" +
          "- **没有匹配素材时**：直接引用随心记内容分享，不要编造与收件人兴趣的关联\n" +
          "- 个人简介用于开场自我介绍\n" +
          "- 不要大段复制粘贴素材原文，用自己的话转述",
      );
    } else {
      parts.push("\n📝 暂无个人要素，请只写简短问候和祝愿，不要编造个人信息。");
    }

    parts.push(`

## 语气风格
${options.tone === "formal" ? "- 正式、礼貌" : options.tone === "casual" ? "- 轻松、随意" : options.tone === "precise" ? `- 语气：准确、简洁
- 只使用素材中的原始事实，不添加感受或联想
- 如果素材与收件人兴趣无关联，直接提问即可，不要编造连接` : options.tone === "warm" ? `- 语气：温暖、真诚
- 基于素材事实，可以添加个人感受和好奇
- 用朋友聊天的口吻，表达对收件人兴趣的真诚好奇` : options.tone === "cultural" ? `- 语气：开放、文化交流
- 侧重分享你所在城市/国家的生活细节
- 用本地人的视角介绍有趣的文化差异` : "- 友好、温暖、真诚"}
- 像真实朋友写的信，有温度、有个性
- 禁止使用模板化套话

## ❌ 禁止使用的套话
- "I noticed from your profile that..."
- "That's wonderful!"
- "How interesting!"
- "I hope this card finds you well"
- "Wishing you all the best"
- "Happy Postcrossing!"
- 任何听起来像 AI 生成的客套话

## 输出格式
请输出 JSON 格式：
{
  "en": "${month} ${day}, ${year} 25°C ☀️\\n\\nHi ${postcard.recipientName},\\n\\n...(正文，90-120 词)...\\n\\nBest,\\nYour Name",
  "zh": "中文翻译"
}

## ✅ 正确示例

### 示例 1：素材与收件人兴趣有关联时（约 100 词）

**素材**: "I'm a software developer who loves weekend photography walks. My daughter just turned 3."
**收件人**: Tijn, Netherlands, 爱好 photography and street art

**正确输出**:
{
  "en": "Jul 15, 2024 26°C ☀️\\n\\nHi Tijn,\\n\\nGreetings from Shenzhen! I'm a software developer who escapes code by wandering the city with my camera on weekends. There's something meditative about framing the world one shot at a time.\\n\\nI see you're into photography too — do you have a favorite style or subject? I've been trying to capture more street scenes lately. Also curious about the street art scene in your area — any hidden gems worth checking out?\\n\\nWishing you great light for your next shoot!\\n\\nWarm regards,\\nPostWizard User",
  "zh": "...中文翻译..."
}

**为什么好**: 素材明确提到摄影 → 与收件人兴趣真实关联 → 自然连接，不编造

### 示例 2：素材与收件人兴趣没有关联时（约 100 词）

**素材**: 个人简介中有运动目标和家庭信息，随心记中有职业转变和新爱好探索
**收件人**: Tijn, Netherlands, 爱好 vintage cars and flea markets

**正确输出**:
{
  "en": "Jul 15, 2024 26°C ☀️\\n\\nHi Tijn,\\n\\nGreetings from Shenzhen! I recently took a leap and left my job to teach myself coding. Been building an open-source project, which keeps me up late but loving it. When I need a break, I go for long rides — working towards a big milestone goal!\\n\\nYour passion for vintage cars sounds fascinating — what got you into it? I'd love to hear the story. And flea markets seem like such an adventure.\\n\\nWishing you sunny skies for your next outing!\\n\\nBest,\\nArthur",
  "zh": "...中文翻译..."
}

**为什么好**:
- 使用了 3 个素材细节：职业转变、开源项目、运动目标
- 用随心记充实自我介绍 → 内容丰富不空洞
- 与收件人兴趣没有关联 → 不编造，诚实好奇
- 🚫 没有说 "As a coder, I appreciate the engineering of vintage cars" → 这就是编造`);

    return parts.join("");
  }

  /**
   * 生成模拟内容（用于测试）- 返回双语版本
   */
  private generateMockContent(
    postcard: any,
    options: GenerationOptions,
    matchedMaterials: MatchedMaterial[] = [],
  ): { contentEn: string; contentZh: string } {
    // 处理兴趣列表 - 分离中英文
    const interestsRaw =
      postcard.recipientInterests || "various interesting things";

    // 提取英文部分（| 之前的部分）
    const interestsEn = interestsRaw
      .split(/[,，]/)
      .map((item: string) => {
        const parts = item.split("|").map((p: string) => p.trim());
        return parts[0] || item.trim(); // 取 | 前面的英文部分
      })
      .filter(Boolean)
      .join(", ");

    // 提取中文部分（| 之后的部分）
    const interestsZh = interestsRaw
      .split(/[,，]/)
      .map((item: string) => {
        const parts = item.split("|").map((p: string) => p.trim());
        return parts[1] || item.trim(); // 取 | 后面的中文部分
      })
      .filter(Boolean)
      .join("、");

    // 英文版
    const greetingEn = `Dear ${postcard.recipientName},\n\nHello! I'm so excited to connect with you through Postcrossing.`;
    const bodyEn = `I'm from ${this.senderCity}, China where people are warm and friendly. I noticed from your profile that you're interested in ${interestsEn}, which is awesome!

${matchedMaterials.length > 0 ? `I also enjoy ${matchedMaterials.map((m) => m.content).join(", ")}. It's great to find someone with similar interests!` : ""}

I hope this postcard brings you joy and surprise. Looking forward to hearing from you and learning more about ${postcard.recipientCity}.

Best wishes from China!`;
    const contentEn = `${greetingEn}\n\n${bodyEn}`;

    // 中文版
    const greetingZh = `亲爱的${postcard.recipientName}：\n\n你好！很高兴能通过 Postcrossing 与你取得联系。`;
    const bodyZh = `我来自中国${this.senderCity}，这里的人们热情友好。看到你的资料，发现你对${interestsZh}感兴趣，这真的很棒！

${matchedMaterials.length > 0 ? `我也喜欢${matchedMaterials.map((m) => m.content).join("、")}。能遇到有共同兴趣的朋友真是太好了！` : ""}

希望这张明信片能带给你一份惊喜和快乐。期待收到你的回信，了解更多关于${postcard.recipientCity}的故事。

祝好！`;
    const contentZh = `${greetingZh}\n\n${bodyZh}`;

    return { contentEn, contentZh };
  }

  /**
   * 获取已生成的内容
   */
  async getGeneratedContent(contentId: string) {
    return prisma.sentCardContent.findUnique({
      where: { id: contentId },
      include: {
        postcard: {
          select: {
            id: true,
            postcardId: true,
            recipientName: true,
            recipientCountry: true,
            recipientCity: true,
            recipientAddress: true,
            recipientAge: true,
            recipientGender: true,
            recipientInterests: true,
            coreInterests: true,
            recipientBio: true,
          },
        },
      },
    });
  }

  /**
   * 批量获取已生成的内容（用于打印）
   * @param contentIds 内容 ID 数组
   */
  async getGeneratedContents(contentIds: string[]) {
    return prisma.sentCardContent.findMany({
      where: {
        id: { in: contentIds },
      },
      include: {
        postcard: {
          select: {
            recipientName: true,
            recipientCountry: true,
            recipientCity: true,
            postcardId: true,
          },
        },
      },
    });
  }

  /**
   * 获取最近生成的 N 条内容（用于快速打印）
   * @param limit 数量限制
   */
  async getRecentGeneratedContents(limit: number = 10) {
    return prisma.sentCardContent.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        postcard: {
          select: {
            recipientName: true,
            recipientCountry: true,
            recipientCity: true,
            postcardId: true,
          },
        },
      },
    });
  }

  /**
   * 更新生成的内容
   */
  async updateGeneratedContent(
    contentId: string,
    updates: {
      contentBody?: string;
      contentTitle?: string;
      isFavorite?: boolean;
      notes?: string;
    },
  ) {
    return prisma.sentCardContent.update({
      where: { id: contentId },
      data: updates,
    });
  }

  /**
   * 批量生成明信片内容
   */
  async generatePostcards(
    analyses: Map<string, AnalysisResult>,
  ): Promise<Map<string, PostcardContent>> {
    const results = new Map<string, PostcardContent>();
    for (const [postcardId, analysis] of analyses.entries()) {
      // 确保 interests 安全处理（即使为 undefined）
      const safeAnalysis: AnalysisResult = {
        ...analysis,
        interests: analysis.interests || [],
      };
      const content = await this.generatePostcard(safeAnalysis, postcardId);
      results.set(postcardId, content);
    }
    return results;
  }
}

// 导出服务实例
export const generationService = new GenerationService();
