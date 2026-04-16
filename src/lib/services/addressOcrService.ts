/**
 * 地址图片 OCR 识别服务
 * 
 * 使用统一的 AI 模型识别 Postcrossing 地址图片中的文字地址
 * 模型配置从数据库动态获取（与 aiParserService 统一）
 */

export interface AddressOCRResult {
  success: boolean;
  /** 收件人姓名 */
  recipientName?: string;
  /** 街道地址 */
  street?: string;
  /** 城市 */
  city?: string;
  /** 州/省 */
  state?: string;
  /** 邮编 */
  postalCode?: string;
  /** 国家 */
  country?: string;
  /** 完整地址（多行格式） */
  fullAddress?: string;
  /** 原始识别文本 */
  rawText?: string;
  /** 错误信息 */
  error?: string;
}

/**
 * 使用 AI 识别地址图片
 * 
 * @param imageUrl - 地址图片 URL（Postcrossing 的地址图片）
 * @param cookie - Postcrossing 登录 cookie（用于下载图片）
 * @returns 识别结果
 */
export async function recognizeAddressWithAI(
  imageUrl: string,
  cookie: string
): Promise<AddressOCRResult> {
  try {
    // console.log(`[Address OCR] 开始识别地址图片: ${imageUrl}`);
    
    // 1. 下载地址图片
    const imageResponse = await fetch(imageUrl, {
      headers: {
        "Cookie": cookie,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!imageResponse.ok) {
      return {
        success: false,
        error: `下载图片失败: HTTP ${imageResponse.status}`,
      };
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    
    // console.log(`[Address OCR] 图片下载成功，大小: ${imageBuffer.byteLength} bytes`);

    // 2. 从数据库动态获取 AI 配置（与 aiParserService 统一）
    const { getAIConfigFromDB } = await import('./ai-config');
    const aiConfig = await getAIConfigFromDB();
    
    if (!aiConfig.apiKey) {
      return {
        success: false,
        error: "未配置 AI API Key",
      };
    }

    // OCR 使用数据库配置的模型（用户应配置支持视觉的模型，如 qwen-vl-plus）
    // 如果用户配置的模型不支持视觉，OCR 会失败
    
    // 打印 OCR 使用的配置信息
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[Address OCR] AI 配置 (从数据库读取):');
    console.log(`  → baseUrl: ${aiConfig.baseUrl}`);
    console.log(`  → model: ${aiConfig.model}`);
    // 检查是否可能不支持视觉
    if (!aiConfig.model.includes('vl')) {
      console.log(`  ⚠️ 警告: 当前模型 ${aiConfig.model} 可能不支持视觉识别`);
      console.log(`  💡 建议: 请在设置中配置支持视觉的模型（如 qwen-vl-plus）`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 使用 OpenAI 兼容格式的 /chat/completions 端点
    const response = await fetch(aiConfig.baseUrl + '/chat/completions', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${aiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: aiConfig.model, // 使用数据库配置的模型（用户应配置视觉模型）
        messages: [
          {
            role: "system",
            content: `你是一个地址信息提取助手。请从图片中提取收件人的完整地址信息。

提取要求：
1. 仔细识别图片中的每一行文字
2. 区分收件人姓名、街道地址、城市、州/省、邮编、国家
3. 如果某些信息无法识别，留空即可
4. 保持原始语言的准确性

请以 JSON 格式返回：
{
  "recipientName": "收件人姓名",
  "street": "街道地址",
  "city": "城市",
  "state": "州/省（如果有）",
  "postalCode": "邮编",
  "country": "国家",
  "fullAddress": "完整多行地址",
  "rawText": "识别出的原始文本（保留换行）"
}`
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${base64Image}`
                }
              },
              {
                type: "text",
                text: "请识别这张地址图片中的所有信息，以 JSON 格式返回。"
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 1000
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // console.error(`[Address OCR] AI API 错误: ${response.status}`, errorText);
      return {
        success: false,
        error: `AI API 错误: ${response.status}`,
      };
    }

    const result = await response.json();
    
    // 处理 OpenAI 兼容格式响应
    // 格式: { choices: [{ message: { content: "..." } }] }
    let content = result.choices?.[0]?.message?.content || "{}";
    
    if (typeof content !== 'string') {
      content = JSON.stringify(content);
    }
    
    // console.log(`[Address OCR] AI 返回内容:`, content.substring(0, 500));

    // 3. 解析 AI 返回的 JSON
    // 尝试提取 JSON 部分（AI 可能会返回 markdown 格式的代码块）
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                      content.match(/```\s*([\s\S]*?)\s*```/) ||
                      [null, content];
    
    const jsonStr = jsonMatch[1].trim();
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      // 如果解析失败，尝试直接解析整个内容
      parsed = JSON.parse(content);
    }



    return {
      success: true,
      recipientName: parsed.recipientName || "",
      street: parsed.street || "",
      city: parsed.city || "",
      state: parsed.state || "",
      postalCode: parsed.postalCode || "",
      country: parsed.country || "",
      fullAddress: parsed.fullAddress || "",
      rawText: parsed.rawText || "",
    };

  } catch (error) {
    // console.error("[Address OCR] 识别错误:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "OCR 识别失败",
    };
  }
}

/**
 * 批量识别多个地址图片
 * 
 * @param addresses - 地址图片 URL 列表
 * @param cookie - Postcrossing 登录 cookie
 * @returns 识别结果列表
 */
export async function recognizeMultipleAddresses(
  addresses: { postcardId: string; imageUrl: string }[],
  cookie: string
): Promise<Map<string, AddressOCRResult>> {
  const results = new Map<string, AddressOCRResult>();

  for (const { postcardId, imageUrl } of addresses) {
    // console.log(`[批量 OCR] 处理 ${postcardId}...`);
    
    const result = await recognizeAddressWithAI(imageUrl, cookie);
    results.set(postcardId, result);

    // 添加延迟，避免请求过快
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}
