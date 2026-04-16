/**
 * 混合地址 OCR 识别服务
 * 
 * 策略：
 * 1. 先用 Tesseract.js (本地 OCR) 识别
 * 2. 如果置信度 >= 85% 且识别出关键字段，直接返回
 * 3. 如果置信度低或识别失败，降级到 AI OCR (qwen-vl-plus)
 * 
 * 优势：
 * - 大部分清晰图片免费识别
 * - 复杂情况自动降级到 AI
 * - 平均成本降低 70-80%
 */

import Tesseract from "tesseract.js";
import { recognizeAddressWithAI, AddressOCRResult } from "./addressOcrService";

// 本地 OCR 最低置信度阈值
const LOCAL_OCR_CONFIDENCE_THRESHOLD = 85;

// 地址关键词，用于验证识别质量
const ADDRESS_KEYWORDS = [
  "str", "street", "ave", "avenue", "road", "rd", "blvd", "boulevard",
  "platz", "straße", "strasse", "weg", "allee",
  "zip", "postal", "code"
];

export interface HybridOCRResult extends AddressOCRResult {
  /** 使用的 OCR 引擎 */
  engine: "tesseract" | "qwen-vl";
  /** Tesseract 置信度 (0-100) */
  confidence?: number;
  /** 是否降级到 AI */
  fallbackToAI?: boolean;
  /** 降级原因 */
  fallbackReason?: string;
}

/**
 * 使用 Tesseract.js 进行本地 OCR
 */
async function recognizeWithTesseract(imageBuffer: ArrayBuffer): Promise<{
  success: boolean;
  text: string;
  confidence: number;
  error?: string;
}> {
  try {
    // console.log("[Hybrid OCR] 使用 Tesseract.js 本地识别...");
    
    const buffer = Buffer.from(imageBuffer);
    
    // 使用 Tesseract 识别
    // eng = 英文, deu = 德文 (Postcrossing 常用)
    const result = await Tesseract.recognize(
      buffer,
      "eng+deu", // 支持英文和德文
      {
        logger: (m) => {
          if (m.status === "recognizing text") {
            // console.log(`[Tesseract] 进度: ${(m.progress * 100).toFixed(1)}%`);
          }
        },
      }
    );

    const text = result.data.text;
    const confidence = result.data.confidence;

    // console.log(`[Tesseract] 识别完成，置信度: ${confidence}%`);
    // console.log(`[Tesseract] 识别文本:\n${text.substring(0, 200)}`);

    return {
      success: true,
      text,
      confidence,
    };
  } catch (error) {
    // console.error("[Tesseract] 识别错误:", error);
    return {
      success: false,
      text: "",
      confidence: 0,
      error: error instanceof Error ? error.message : "Tesseract 识别失败",
    };
  }
}

/**
 * 从 Tesseract 原始文本解析地址结构
 */
function parseAddressFromText(text: string): Partial<AddressOCRResult> {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // console.log("[Hybrid OCR] 解析地址行:", lines);

  // 简单的启发式解析
  let recipientName = "";
  let street = "";
  let city = "";
  let state = "";
  let postalCode = "";
  let country = "";

  // 第一行通常是姓名
  if (lines.length > 0) {
    recipientName = lines[0];
  }

  // 最后一行通常是国家（如果是大写或常见国家名）
  if (lines.length > 1) {
    const lastLine = lines[lines.length - 1].toUpperCase();
    const commonCountries = [
      "GERMANY", "DEUTSCHLAND", "USA", "UNITED STATES", "UK", "UNITED KINGDOM",
      "FRANCE", "JAPAN", "CHINA", "CANADA", "AUSTRALIA", "NETHERLANDS", "BELGIUM",
      "ITALY", "SPAIN", "SWEDEN", "NORWAY", "DENMARK", "FINLAND", "AUSTRIA",
      "SWITZERLAND", "POLAND", "CZECH", "HUNGARY", "RUSSIA", "BRAZIL"
    ];
    
    if (commonCountries.some((c) => lastLine.includes(c))) {
      country = lines[lines.length - 1];
      lines.pop(); // 移除国家行
    }
  }

  // 解析中间行（街道和城市）
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    
    // 检测邮编 (4-6位数字，可能在行首或行尾)
    const postalMatch = line.match(/(\d{4,6})/);
    if (postalMatch && !postalCode) {
      postalCode = postalMatch[1];
      
      // 邮编通常在地址行，尝试分离城市
      const parts = line.split(postalCode).map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 1) {
        // 邮编前的部分可能是城市
        if (parts[0] && !street.includes(parts[0])) {
          city = parts[0].replace(/[,\s]+$/, ""); // 移除尾部逗号和空格
        }
        // 邮编后的部分可能是城市
        if (parts[1] && !city) {
          city = parts[1].replace(/^[\s,]+/, "");
        }
      }
    }
    
    // 检测街道关键词
    const hasStreetKeyword = ADDRESS_KEYWORDS.some((kw) =>
      line.toLowerCase().includes(kw)
    );
    
    if (hasStreetKeyword && !street) {
      street = line;
    }
  }

  // 如果没找到街道，取第二行
  if (!street && lines.length > 1) {
    street = lines[1];
  }

  // 构建完整地址
  const fullAddressLines = [recipientName, street, city && postalCode ? `${postalCode} ${city}` : city, country].filter(Boolean);

  return {
    success: true,
    recipientName,
    street,
    city,
    state,
    postalCode,
    country,
    fullAddress: fullAddressLines.join("\n"),
    rawText: text,
  };
}

/**
 * 评估本地 OCR 结果是否可用
 */
function isLocalResultValid(result: { confidence: number; parsed: Partial<AddressOCRResult> }): {
  valid: boolean;
  reason?: string;
} {
  // 置信度检查
  if (result.confidence < LOCAL_OCR_CONFIDENCE_THRESHOLD) {
    return {
      valid: false,
      reason: `置信度 ${result.confidence}% 低于阈值 ${LOCAL_OCR_CONFIDENCE_THRESHOLD}%`,
    };
  }

  // 关键字段检查
  const { parsed } = result;
  if (!parsed.recipientName || parsed.recipientName.length < 2) {
    return { valid: false, reason: "未识别出收件人姓名" };
  }

  // 至少要有街道或城市
  if ((!parsed.street || parsed.street.length < 3) && (!parsed.city || parsed.city.length < 2)) {
    return { valid: false, reason: "未识别出有效地址信息" };
  }

  return { valid: true };
}

/**
 * 混合 OCR 识别（优先本地，失败降级 AI）
 * 
 * @param imageUrl - 地址图片 URL
 * @param cookie - Postcrossing 登录 cookie
 * @param forceAI - 强制使用 AI OCR（跳过本地）
 */
export async function recognizeAddressHybrid(
  imageUrl: string,
  cookie: string,
  forceAI: boolean = false
): Promise<HybridOCRResult> {
  const startTime = Date.now();
  
  // console.log("=".repeat(60));
  // console.log("[Hybrid OCR] 开始混合 OCR 识别");
  // console.log(`[Hybrid OCR] 图片 URL: ${imageUrl}`);
  // console.log(`[Hybrid OCR] 强制 AI: ${forceAI}`);
  // console.log("=".repeat(60));

  // 1. 下载图片
  let imageBuffer: ArrayBuffer;
  try {
    const response = await fetch(imageUrl, {
      headers: {
        Cookie: cookie,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      return {
        success: false,
        engine: "tesseract",
        error: `下载图片失败: HTTP ${response.status}`,
      };
    }

    imageBuffer = await response.arrayBuffer();
    // console.log(`[Hybrid OCR] 图片下载成功: ${imageBuffer.byteLength} bytes`);
  } catch (error) {
    return {
      success: false,
      engine: "tesseract",
      error: `下载图片失败: ${error instanceof Error ? error.message : "未知错误"}`,
    };
  }

  // 2. 如果不强制 AI，先尝试本地 OCR
  if (!forceAI) {
    const localResult = await recognizeWithTesseract(imageBuffer);
    
    if (localResult.success) {
      const parsed = parseAddressFromText(localResult.text);
      
      // 评估本地结果质量
      const validation = isLocalResultValid({
        confidence: localResult.confidence,
        parsed,
      });

      if (validation.valid) {
        const elapsed = Date.now() - startTime;
        // console.log(`[Hybrid OCR] ✅ Tesseract 识别成功 (耗时: ${elapsed}ms)`);
        
        return {
          success: true,
          engine: "tesseract",
          confidence: localResult.confidence,
          recipientName: parsed.recipientName,
          street: parsed.street,
          city: parsed.city,
          state: parsed.state,
          postalCode: parsed.postalCode,
          country: parsed.country,
          fullAddress: parsed.fullAddress,
          rawText: parsed.rawText,
          fallbackToAI: false,
        };
      } else {
        // console.log(`[Hybrid OCR] ⚠️ Tesseract 结果质量不足: ${validation.reason}`);
        // console.log("[Hybrid OCR] 降级到 AI OCR...");
      }
    } else {
      // console.log(`[Hybrid OCR] ⚠️ Tesseract 失败: ${localResult.error}`);
      // console.log("[Hybrid OCR] 降级到 AI OCR...");
    }
  }

  // 3. 本地失败或强制 AI，调用 AI OCR
  const aiResult = await recognizeAddressWithAI(imageUrl, cookie);
  const elapsed = Date.now() - startTime;
  
  // console.log(`[Hybrid OCR] AI OCR 完成 (耗时: ${elapsed}ms)`);

  return {
    ...aiResult,
    engine: "qwen-vl",
    fallbackToAI: !forceAI,
    fallbackReason: forceAI ? "用户强制使用 AI" : "Tesseract 识别质量不足",
  };
}

/**
 * 批量混合识别
 */
export async function recognizeMultipleHybrid(
  addresses: { postcardId: string; imageUrl: string }[],
  cookie: string,
  forceAI: boolean = false
): Promise<Map<string, HybridOCRResult>> {
  const results = new Map<string, HybridOCRResult>();
  let localCount = 0;
  let aiCount = 0;

  // console.log(`[批量混合 OCR] 开始处理 ${addresses.length} 张地址图片`);

  for (const { postcardId, imageUrl } of addresses) {
    // console.log(`\n[批量混合 OCR] 处理 ${postcardId}...`);
    
    const result = await recognizeAddressHybrid(imageUrl, cookie, forceAI);
    results.set(postcardId, result);

    if (result.engine === "tesseract") localCount++;
    else aiCount++;

    // 添加延迟，避免请求过快
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // console.log(`\n[批量混合 OCR] 完成: ${localCount} 张本地识别, ${aiCount} 张 AI 识别`);
  
  return results;
}
