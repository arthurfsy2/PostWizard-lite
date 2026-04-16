/**
 * Postcrossing 同步服务
 * 
 * 功能：同步用户的 Postcrossing 账户数据
 * - 登录获取 Cookie
 * - 获取 traveling 明信片数据
 * - 获取 sent/received 统计数据
 */

import { PrismaClient } from "@prisma/client";
import { decryptSafe } from "../crypto";

const prisma = new PrismaClient();

// Postcrossing 配置
const POSTCROSSING_BASE_URL = "https://www.postcrossing.com";
const POSTCROSSING_LOGIN_URL = `${POSTCROSSING_BASE_URL}/login`;

// 用户代理（模拟 Chrome 浏览器，与 Python 脚本保持一致）
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Cookie 存储键前缀
const COOKIE_KEY_PREFIX = "postcrossing_cookie:";

/**
 * 用户 Postcrossing 配置类型
 */
export interface PostcrossingAccount {
  userId: string;
  username: string;
  password: string; // 加密存储
  isActive: boolean;
  lastSyncAt: Date | null;
  cookie: string | null;
  cookieExpiresAt: Date | null;
}

/**
 * Traveling 明信片数据结构
 */
export interface TravelingPostcard {
  postcardId: string;
  receiverUsername: string;
  status: number;
  countryCode: string;
  sentTimestamp: number;
  sentDate: string;
  arrivedFlag: number;
  distance: number;
  // 原始数据
  rawData: any[];
}

/**
 * 同步结果
 */
export interface SyncResult {
  success: boolean;
  message: string;
  data?: {
    travelingCount: number;
    traveling: TravelingPostcard[];
    lastSyncAt: Date;
  };
  error?: string;
}

/**
 * 带重定向处理的 fetch（收集所有重定向过程中的 cookie）
 */
async function fetchWithRedirectHandling(
  url: string,
  options: RequestInit,
  maxRedirects: number = 5
): Promise<{ status: number; url: string; cookies: Record<string, string> }> {
  const cookies: Record<string, string> = {};
  let currentUrl = url;
  let currentOptions = { ...options, redirect: "manual" as const };
  
  for (let i = 0; i < maxRedirects; i++) {
    const response = await fetch(currentUrl, currentOptions);
    
    // 提取本次响应的 cookie
    const setCookieHeader = response.headers.get("set-cookie");
    if (setCookieHeader) {
      const newCookies = parseCookies(setCookieHeader);
      Object.assign(cookies, newCookies);
      // console.log(`  [重定向 ${i + 1}] ${currentUrl} -> Status: ${response.status}, Cookies: ${Object.keys(newCookies).join(", ") || "none"}`);
    } else {
      // console.log(`  [重定向 ${i + 1}] ${currentUrl} -> Status: ${response.status}, No cookies`);
    }
    
    // 检查是否是重定向
    const location = response.headers.get("location");
    if (location && (response.status === 301 || response.status === 302 || response.status === 303 || response.status === 307 || response.status === 308)) {
      // 跟随重定向
      currentUrl = location.startsWith("http") ? location : new URL(location, currentUrl).toString();
      // 后续请求需要带上已收集的 cookie
      currentOptions = {
        ...currentOptions,
        headers: {
          ...currentOptions.headers,
          Cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; "),
        },
      };
    } else {
      // 不是重定向，返回结果
      return {
        status: response.status,
        url: currentUrl,
        cookies,
      };
    }
  }
  
  throw new Error(`Too many redirects (max: ${maxRedirects})`);
}

/**
 * 提取 CSRF Token
 */
async function extractCsrfToken(html: string): Promise<string | null> {
  const match = html.match(
    /name="signin\[_login_csrf_token\]" value="(.*?)"/
  );
  return match ? match[1] : null;
}

/**
 * 登录 Postcrossing 获取 Cookie
 */
export async function loginPostcrossing(
  username: string,
  password: string
): Promise<{ success: boolean; cookie?: string; error?: string }> {
  try {
    // Step 1: 获取登录页面和 CSRF Token（同时获取初始 session cookie）
    const loginPageResponse = await fetch(POSTCROSSING_LOGIN_URL, {
      redirect: "manual",
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    // 检查是否成功获取页面或得到初始 cookie
    if (loginPageResponse.status === 302) {
      // 跟随初始重定向获取 session cookie
      const location = loginPageResponse.headers.get("location");
      if (location) {
        const redirectUrl = location.startsWith("http") ? location : new URL(location, POSTCROSSING_BASE_URL).toString();
        const redirectResponse = await fetch(redirectUrl, {
          redirect: "manual",
          headers: {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
          },
        });
        
        const setCookie = redirectResponse.headers.get("set-cookie");
        // console.log("[Step 1] 初始重定向获取的 Cookie:", setCookie?.substring(0, 100));
        
        if (setCookie) {
          const parsed = parseCookies(setCookie);
          // console.log("[Step 1] 解析到的 Cookie 键:", Object.keys(parsed).join(", "));
        }
      }
    }

    // 提取初始 session cookie（如果返回了 Set-Cookie 头）
    const initialCookies: Record<string, string> = {};
    const initialSetCookie = loginPageResponse.headers.get("set-cookie");
    if (initialSetCookie) {
      const parsed = parseCookies(initialSetCookie);
      Object.assign(initialCookies, parsed);
      // console.log("[Step 1] 初始 Cookies:", Object.keys(parsed).join(", "));
    }

    const loginPageHtml = await loginPageResponse.text();
    const csrfToken = await extractCsrfToken(loginPageHtml);

    if (!csrfToken) {
      return { success: false, error: "无法提取 CSRF Token" };
    }

    // Step 2: 准备表单数据
    const formData = new URLSearchParams();
    formData.append("signin[username]", username);
    formData.append("signin[password]", password);
    formData.append("signin[_login_csrf_token]", csrfToken);
    formData.append("signin[remember]", "on");

    // Step 3: 提交登录表单（带上初始 session cookie）
    // console.log("[Step 2] 提交登录表单...");
    const loginResult = await fetchWithRedirectHandling(
      POSTCROSSING_LOGIN_URL,
      {
        method: "POST",
        headers: {
          "User-Agent": USER_AGENT,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Referer": POSTCROSSING_LOGIN_URL,
          "Content-Type": "application/x-www-form-urlencoded",
          "Origin": POSTCROSSING_BASE_URL,
          // 带上初始 session cookie
          Cookie: Object.entries(initialCookies)
            .map(([k, v]) => `${k}=${v}`)
            .join("; "),
        },
        body: formData.toString(),
      }
    );

    // 调试信息
    // console.log("[Postcrossing 登录调试]");
    // console.log("  最终 Status:", loginResult.status);
    // console.log("  最终 URL:", loginResult.url);
    // console.log("  所有 Cookies:", Object.keys(loginResult.cookies).join(", "));

    // 检查是否获取到有效的 Cookie（登录成功的标志）
    const sessionCookie = loginResult.cookies["__Host-postcrossing"];
    if (!sessionCookie) {
      return { success: false, error: "登录失败，请检查用户名和密码" };
    }

    const rememberCookie = loginResult.cookies["PostcrossingRemember"] || "";
    const cookieString = `__Host-postcrossing=${sessionCookie}; PostcrossingRemember=${rememberCookie}`;

    return { success: true, cookie: cookieString };
  } catch (error) {
    // console.error("Postcrossing 登录错误:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}

/**
 * 解析 Cookie 字符串
 * 
 * 注意：使用分号分割，避免 Expires 日期中的逗号造成错误分割
 */
function parseCookies(setCookieHeader: string | string[]): Record<string, string> {
  const cookies: Record<string, string> = {};
  
  // 如果是数组（来自 getSetCookie()），直接逐个处理
  const entries = Array.isArray(setCookieHeader) 
    ? setCookieHeader 
    : [setCookieHeader];
  
  for (const entry of entries) {
    // 只取第一个分号之前的部分（即 name=value）
    const [nameValue] = entry.split(";");
    const trimmed = nameValue.trim();
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex > 0) {
      const name = trimmed.substring(0, eqIndex).trim();
      const value = trimmed.substring(eqIndex + 1).trim();
      if (name && value) {
        cookies[name] = value;
      }
    }
  }
  
  return cookies;
}

/**
 * 验证 Cookie 是否有效
 */
export async function verifyCookie(
  username: string,
  cookie: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${POSTCROSSING_BASE_URL}/user/${username}/sent`,
      {
        headers: {
          "User-Agent": USER_AGENT,
          Cookie: cookie,
        },
        redirect: "manual",
      }
    );

    // 调试信息
    // console.log("[Cookie 验证调试]");
    // console.log("  Status:", response.status);
    // console.log("  Location:", response.headers.get("location"));

    // 如果重定向到登录页 (302/303 且 location 包含 /login)，说明 Cookie 无效
    const location = response.headers.get("location");
    const isRedirectToLogin = (response.status === 302 || response.status === 303) && 
                               location && location.includes("/login");
    const isValid = !isRedirectToLogin;
    
    // console.log("  Cookie 有效:", isValid);
    return isValid;
  } catch (error) {
    // console.error("Cookie 验证错误:", error);
    return false;
  }
}

/**
 * 获取 traveling 数据
 */
export async function getTravelingData(
  username: string,
  cookie: string
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const url = `${POSTCROSSING_BASE_URL}/user/${username}/data/traveling`;
    
    // 使用与 Python 脚本一致的请求头
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.5",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": `${POSTCROSSING_BASE_URL}/user/${username}/traveling`,
        "Cookie": cookie,
      },
    });

    if (!response.ok) {
      if (response.status === 400) {
        return { success: false, error: "Cookie 已过期，请重新登录" };
      }
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    // console.error("获取 traveling 数据错误:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}

/**
 * 用户主页信息
 */
export interface UserProfile {
  username: string;
  aboutText: string;
  rawHtml: string;
  // 现有字段（已修复正则）
  registeredSince?: string;  // 从 "Joined" 提取
  lastLogin?: string;        // 从 "Seen" 提取
  // 新增字段（V2.1 升级）
  displayName?: string;      // 显示名称
  country?: string;          // 国家名称
  languages?: string;        // 语言（如 "English, Chinese"）
  pronouns?: string;         // 代词（如 "he/him"）
  birthday?: string;         // 生日（如 "7th May"）
  email?: string;            // 邮箱（从 aboutText 提取）
  sentCount?: number;        // 寄出数量
  receivedCount?: number;    // 收到数量
}

/**
 * 获取 Postcrossing 用户主页信息
 * 
 * 注意：用户主页可见性设置影响访问方式
 * - 公开：不需要 cookie 即可访问
 * - 仅限成员：需要带 cookie 才能访问
 */
export async function getUserProfile(
  username: string,
  cookie?: string
): Promise<{ 
  success: boolean; 
  data?: UserProfile; 
  error?: string;
  isPrivate?: boolean; // 标记是否为私密资料
}> {
  try {
    const url = `${POSTCROSSING_BASE_URL}/user/${username}`;

    const headers: Record<string, string> = {
      "User-Agent": USER_AGENT,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
    };

    if (cookie) {
      headers["Cookie"] = cookie;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, error: "用户不存在" };
      }
      return { success: false, error: `HTTP ${response.status}` };
    }

    const html = await response.text();

    // 检查是否需要登录（私密资料）
    if (html.includes("Log in") && html.includes("to see more information")) {
      return { 
        success: false, 
        error: "该用户资料设置为私密，需要登录后查看",
        isPrivate: true,
      };
    }

    // 检查是否被重定向到登录页
    if (html.includes('name="signin[_login_csrf_token]"')) {
      return { 
        success: false, 
        error: "该用户资料设置为私密，需要登录后查看",
        isPrivate: true,
      };
    }

    // 提取 about-text 内容
    const aboutMatch = html.match(/<div class="about-text">([\s\S]*?)<\/div>/);

    if (!aboutMatch) {
      return { success: false, error: "用户未填写简介" };
    }

    // 清理 HTML 标签，获取纯文本
    const rawHtml = aboutMatch[1];
    const textContent = rawHtml
      .replace(/<[^>]+>/g, '\n')  // 替换标签为换行
      .replace(/\n\s*\n/g, '\n')   // 合并多个换行
      .trim();

    // 提取注册时间（修复正则：实际 HTML 用 "Joined" 而非 "Registered since"）
    const registeredMatch = html.match(/Joined[\s\S]*?<abbr[^>]*title="([^"]+)"[^>]*>/);
    const registeredSince = registeredMatch ? registeredMatch[1].trim() : undefined;

    // 提取最后登录时间（修复正则：实际 HTML 用 "Seen" 而非 "Last login"）
    const lastLoginMatch = html.match(/Seen[\s\S]*?<span[^>]*>([^<]+)<\/span>/);
    const lastLogin = lastLoginMatch ? lastLoginMatch[1].trim() : undefined;

    // ========== 新增字段提取（V2.1 升级）==========

    // 提取显示名称：从 "About XXX..." 提取
    const displayNameMatch = html.match(/<h2[^>]*>About\s+([^..<]+)/);
    const displayName = displayNameMatch ? displayNameMatch[1].trim() : undefined;

    // 提取国家：从 itemprop="address" 提取
    const countryMatch = html.match(/<a[^>]*itemprop="address"[^>]*>[\s\n]*([^<]+)[\s\n]*<\/a>/);
    const country = countryMatch ? countryMatch[1].trim() : undefined;

    // 提取语言：从 title="Speaks" 提取
    const languagesMatch = html.match(/<li[^>]*title="Speaks"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/);
    const languages = languagesMatch ? languagesMatch[1].trim() : undefined;

    // 提取代词：从 title="Gender pronouns" 提取
    const pronounsMatch = html.match(/<li[^>]*title="Gender pronouns"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/);
    const pronouns = pronounsMatch ? pronounsMatch[1].trim() : undefined;

    // 提取生日：从 title="Birthday" 提取
    const birthdayMatch = html.match(/<li[^>]*title="Birthday"[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/);
    const birthday = birthdayMatch ? birthdayMatch[1].trim().replace(/\s+/g, ' ') : undefined;

    // 提取邮箱：从 aboutText 中正则匹配
    const emailMatch = textContent.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const email = emailMatch ? emailMatch[1] : undefined;

    // 提取收发数量：从 "sent-and-received" 区域
    const sentCountMatch = html.match(/(\d+)<\/a>[\s]*sent/);
    const sentCount = sentCountMatch ? parseInt(sentCountMatch[1], 10) : undefined;

    const receivedCountMatch = html.match(/(\d+)<\/a>[\s]*received/);
    const receivedCount = receivedCountMatch ? parseInt(receivedCountMatch[1], 10) : undefined;

    return {
      success: true,
      data: {
        username,
        aboutText: textContent,
        rawHtml,
        registeredSince,
        lastLogin,
        // 新增字段
        displayName,
        country,
        languages,
        pronouns,
        birthday,
        email,
        sentCount,
        receivedCount,
      },
    };
  } catch (error) {
    // console.error("获取用户主页信息错误:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}

/**
 * Traveling Postcard 详情（地址信息）
 * 
 * 从 /travelingpostcard/{postcardId} 页面提取收件人姓名和完整地址
 * 注意：此页面需要登录后的 cookie 才能访问
 * 
 * Postcrossing 将地址渲染为图片以保护隐私，需要通过 OCR 处理 addressImageUrl 获取完整地址
 */
export interface TravelingPostcardDetail {
  postcardId: string;
  recipientName: string;
  /** 地址图片 URL，需要通过 OCR 提取文字地址 */
  addressImageUrl?: string;
  country?: string;
  /** 备注信息 */
  note?: string;
  /** 用户头像 URL */
  avatarUrl?: string;
  /** 代词 (如 "she/her") */
  pronouns?: string;
  /** 生日 */
  birthday?: string;
  /** 语言能力 */
  languages?: string[];
  /** 收藏明信片列表 */
  favoritePostcards?: string[];
  /** 发送者坐标 */
  senderCoordinates?: { lat: number; lng: number };
  /** 接收者坐标 */
  receiverCoordinates?: { lat: number; lng: number };
  /** 距离 (km) */
  distance?: number;
  /** 发送日期 */
  sentDate?: string;
}

/**
 * 获取 Traveling Postcard 详情（收件人地址）
 * 
 * @param postcardId - 明信片 ID（如 "DE-1234567"）
 * @param cookie - Postcrossing 登录后的 cookie（必需）
 * @param enableOCR - 是否启用 AI OCR 识别地址图片（可选，默认 false）
 * @returns 收件人姓名和地址信息
 */
export async function getTravelingPostcardDetail(
  postcardId: string,
  cookie: string,
  enableOCR: boolean = false
): Promise<{
  success: boolean;
  data?: TravelingPostcardDetail & {
    /** OCR 识别结果（当 enableOCR=true 时返回） */
    ocrResult?: {
      recipientName?: string;
      street?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
      fullAddress?: string;
      rawText?: string;
    };
  };
  error?: string;
}> {
  try {
    const url = `${POSTCROSSING_BASE_URL}/travelingpostcard/${postcardId}`;
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Cookie": cookie,
      },
      redirect: "manual",
    });

    // 检查是否被重定向到登录页（cookie 无效）
    if (response.status === 302 || response.status === 303) {
      const location = response.headers.get("location");
      if (location?.includes("/login")) {
        return {
          success: false,
          error: "Cookie 已过期或无效，请重新绑定 Postcrossing 账号",
        };
      }
    }

    if (!response.ok) {
      return {
        success: false,
        error: `获取页面失败: HTTP ${response.status}`,
      };
    }

    const html = await response.text();

    // 检查是否包含登录表单（另一种判断方式）
    if (html.includes('name="signin[_login_csrf_token]"')) {
      return {
        success: false,
        error: "Cookie 已过期，请重新绑定 Postcrossing 账号",
      };
    }

    // ========== HTML 解析提取地址信息 ==========
    // 基于实际 travelingpostcard 页面结构：
    // - 收件人名字在 <h2 class="name-username"> 中，格式：
    //   <h2 class="name-username">Susanne<span class="h5">(she/her)<br>aka username</span></h2>
    // - 地址是以图片形式渲染的，URL 格式：https://www.postcrossing.com/travelingpostcard/{id}/address/{x}/{y}

    // 提取收件人姓名
    let recipientName: string | undefined;
    
    // 从 <h2 class="name-username"> 提取
    // 匹配：<h2 class="name-username">Susanne<span...
    const nameMatch = html.match(/<h2[^>]*class="name-username"[^>]*>([A-Za-z]+)\s*<span[^>]*>/i);
    if (nameMatch) {
      recipientName = nameMatch[1].trim();
    }

    // 备选：从 h2.name-username 的直接文本内容提取
    if (!recipientName) {
      const simpleNameMatch = html.match(/<h2[^>]*class="name-username"[^>]*>([\s\S]*?)<\/h2>/);
      if (simpleNameMatch) {
        // 提取第一个非空白、非标签的文本行
        const lines = simpleNameMatch[1].split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length > 0) {
          // 取第一行，去除可能的 <span> 等标签内容
          recipientName = lines[0].replace(/<[^>]+>/g, '').trim();
        }
      }
    }

    // 备选：从页面标题提取（格式: "Postcard CN-1234567"）
    if (!recipientName) {
      const titleMatch = html.match(/<title>Postcard\s+(CN-\d+)<\/title>/);
      if (titleMatch) {
        recipientName = titleMatch[1]; // 使用 postcardId 作为回退
      }
    }

    // 提取地址图片 URL
    // Postcrossing 将地址渲染为图片以保护隐私
    let addressImageUrl: string | undefined;
    // 匹配完整的 HTTPS URL
    const addressImageMatch = html.match(/src="(https:\/\/www\.postcrossing\.com\/travelingpostcard\/[^"]+\/address\/\d+\/\d+)"/);
    if (addressImageMatch) {
      addressImageUrl = addressImageMatch[1];
      console.log(`[getTravelingPostcardDetail] ✅ 地址图片 URL 提取成功: ${addressImageUrl}`);
    } else {
      console.log(`[getTravelingPostcardDetail] ⚠️ 地址图片 URL 提取失败，未找到匹配`);
      // 尝试更宽松的正则
      const altMatch = html.match(/travelingpostcard\/[^\/]+\/address\/\d+\/\d+/);
      if (altMatch) {
        addressImageUrl = `https://www.postcrossing.com/${altMatch[0]}`;
        console.log(`[getTravelingPostcardDetail] ✅ 备选正则匹配成功: ${addressImageUrl}`);
      }
    }

    // 尝试从页面其他位置提取国家
    let country: string | undefined;
    const countryMatch = html.match(/<a[^>]*href="\/country\/[^"]*"[^>]*>([^<]+)<\/a>/);
    if (countryMatch) {
      country = countryMatch[1].trim();
    }

    // ========== 提取更多字段 ==========
    
    // 1. 用户头像 URL
    let avatarUrl: string | undefined;
    const avatarMatch = html.match(/src="(\/\/static2\.postcrossing\.com\/avatars\/[^"]+)"/);
    if (avatarMatch) {
      avatarUrl = avatarMatch[1].startsWith('http') ? avatarMatch[1] : `https:${avatarMatch[1]}`;
    }

    // 2. 代词 (she/her)
    let pronouns: string | undefined;
    const pronounsMatch = html.match(/<h2[^>]*class="name-username"[^>]*>[\s\S]*?<span[^>]*class="h5"[^>]*>\(([^)]+)\)/);
    if (pronounsMatch) {
      pronouns = pronounsMatch[1].trim();
    }

    // 3. 生日 (例如: "9th December")
    let birthday: string | undefined;
    const birthdayMatch = html.match(/alt="birthday"[^>]*>\s*<\/i>\s*<span>([^<]+)<\/span>/i);
    if (birthdayMatch) {
      birthday = birthdayMatch[1].trim();
    }

    // 4. 语言能力 (提取 "speaks" 图标后的内容)
    let languages: string[] | undefined;
    const speaksMatch = html.match(/alt="speaks"[^>]*>\s*<\/i>\s*<span>([^<]+)<\/span>/i);
    if (speaksMatch) {
      // 分割并清理语言列表，例如 "German, English, Finnish (in learning state)"
      languages = speaksMatch[1]
        .split(/,\s*/)
        .map(l => l.trim())
        .filter(Boolean);
    }

    // 5. 收藏明信片图片 URL
    let favoritePostcards: string[] | undefined;
    const favoriteMatches = html.matchAll(/<img[^>]*alt="postcard image of [^"]*"[^>]*src="(\/\/static2\.postcrossing\.com\/postcard\/thumb\/[^"]*)"/g);
    favoritePostcards = Array.from(favoriteMatches).map(match => {
      const url = match[1];
      return url.startsWith('http') ? url : `https:${url}`;
    });
    if (favoritePostcards.length === 0) {
      favoritePostcards = undefined;
    }

    // 6. 坐标 (发送者和接收者)
    let senderCoordinates: { lat: number; lng: number } | undefined;
    let receiverCoordinates: { lat: number; lng: number } | undefined;
    const latMatches = html.matchAll(/<meta[^>]*itemprop="latitude"[^>]*content="([^"]+)"/g);
    const lngMatches = html.matchAll(/<meta[^>]*itemprop="longitude"[^>]*content="([^"]+)"/g);
    const coords = Array.from(latMatches).map((lat, i) => ({
      lat: parseFloat(lat[1]),
      lng: parseFloat(Array.from(lngMatches)[i]?.[1] || '0')
    }));
    if (coords.length >= 1) {
      senderCoordinates = coords[0];
    }
    if (coords.length >= 2) {
      receiverCoordinates = coords[1];
    }

    // 7. 距离 (km)
    let distance: number | undefined;
    const distanceMatch = html.match(/<span>([\d,]+)\s*km<\/span>/);
    if (distanceMatch) {
      distance = parseInt(distanceMatch[1].replace(/,/g, ''), 10);
      console.log(`[getTravelingPostcardDetail] ✅ 距离解析成功: ${distance} km (原始值: ${distanceMatch[1]})`);
    } else {
      console.log(`[getTravelingPostcardDetail] ⚠️ 距离解析失败，未找到匹配模式`);
      // 尝试备选正则
      const altDistanceMatch = html.match(/([\d,]+)\s*km/i);
      if (altDistanceMatch) {
        distance = parseInt(altDistanceMatch[1].replace(/,/g, ''), 10);
        console.log(`[getTravelingPostcardDetail] ✅ 备选正则匹配成功: ${distance} km`);
      }
    }

    // 8. 发送日期
    let sentDate: string | undefined;
    const sentDateMatch = html.match(/<span>(\d{1,2}\s+[A-Za-z]+,\s*\d{4})<\/span>/);
    if (sentDateMatch) {
      sentDate = sentDateMatch[1].trim();
    }

    // 如果没有提取到关键信息，返回降级提示
    if (!recipientName && !addressImageUrl) {
      return {
        success: false,
        error: "无法从页面解析收件人信息，页面结构可能已变化",
      };
    }

    // 如果启用 OCR，则识别地址图片
    // 默认使用混合 OCR 策略（Tesseract 本地 + qwen-vl AI 降级）
    let ocrResult;
    console.log(`[getTravelingPostcardDetail] OCR 检查: enableOCR=${enableOCR}, addressImageUrl=${addressImageUrl ? '存在' : '缺失'}`);
    
    if (enableOCR && addressImageUrl) {
      console.log(`[getTravelingPostcardDetail] 🚀 开始 OCR 识别: ${addressImageUrl}`);
      try {
        // 使用混合 OCR 服务（智能选择本地或 AI）
        const { recognizeAddressHybrid } = await import("./hybridAddressOcrService");
        const ocr = await recognizeAddressHybrid(addressImageUrl, cookie, true); // forceAI=true
        
        if (ocr.success) {
          ocrResult = {
            recipientName: ocr.recipientName,
            street: ocr.street,
            city: ocr.city,
            state: ocr.state,
            postalCode: ocr.postalCode,
            country: ocr.country,
            fullAddress: ocr.fullAddress,
            rawText: ocr.rawText,
            // 混合策略额外信息
            engine: ocr.engine,
            confidence: ocr.confidence,
            fallbackToAI: ocr.fallbackToAI,
          };
          console.log(`[getTravelingPostcardDetail] ✅ OCR 识别成功 (${ocr.engine}):`);
          console.log(`  - 收件人: ${ocr.recipientName}`);
          console.log(`  - 城市: ${ocr.city}`);
          console.log(`  - 国家: ${ocr.country}`);
          console.log(`  - 置信度: ${ocr.confidence}%`);
        } else {
          console.log(`[getTravelingPostcardDetail] ❌ OCR 识别失败: ${ocr.error}`);
        }
      } catch (ocrError) {
        // console.error("[getTravelingPostcardDetail] OCR 错误:", ocrError);
      }
    }

    return {
      success: true,
      data: {
        postcardId,
        recipientName: recipientName || "Unknown",
        addressImageUrl,
        country,
        note: ocrResult 
          ? "地址已通过 AI OCR 识别" 
          : "地址以图片形式提供，如需完整地址请使用 OCR 处理 addressImageUrl",
        ocrResult,
        // 新增字段
        avatarUrl,
        pronouns,
        birthday,
        languages,
        favoritePostcards,
        senderCoordinates,
        receiverCoordinates,
        distance,
        sentDate,
      },
    };
  } catch (error) {
    // console.error("获取 Traveling Postcard 详情错误:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}

/**
 * 批量获取 traveling 中所有收件人的简介
 * 
 * @param traveling - traveling 明信片列表
 * @param cookie - 可选，用于访问私密资料
 */
export async function getTravelingRecipientsProfiles(
  traveling: { receiverUsername: string }[],
  cookie?: string
): Promise<Map<string, UserProfile | null>> {
  const profiles = new Map<string, UserProfile | null>();
  const uniqueUsernames = [...new Set(traveling.map(t => t.receiverUsername))];

  // console.log(`[批量获取简介] 共 ${uniqueUsernames.length} 个唯一用户`);

  for (const username of uniqueUsernames) {
    const result = await getUserProfile(username, cookie);
    if (result.success && result.data) {
      profiles.set(username, result.data);
    } else {
      // console.log(`  - ${username}: ${result.error}`);
      profiles.set(username, null);
    }
    
    // 添加延迟，避免请求过快
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return profiles;
}

/**
 * 解析 traveling 数据
 */
export function parseTravelingData(rawData: any[]): TravelingPostcard[] {
  if (!Array.isArray(rawData)) return [];

  return rawData.map((item) => ({
    postcardId: item[0],
    receiverUsername: item[1],
    status: item[2],
    countryCode: item[3],
    sentTimestamp: item[4],
    sentDate: new Date(item[4] * 1000).toISOString(),
    arrivedFlag: item[5],
    distance: item[6],
    rawData: item,
  }));
}

/**
 * 执行同步
 */
export async function syncPostcrossingData(
  userId: string
): Promise<SyncResult> {
  try {
    // 1. 获取用户配置
    const account = await prisma.postcrossingAccount.findUnique({
      where: { userId },
    });

    if (!account) {
      return { success: false, message: "未配置 Postcrossing 账户" };
    }

    if (!account.isActive) {
      return { success: false, message: "Postcrossing 同步已禁用" };
    }

    // 2. 验证/刷新 Cookie
    let cookie = account.cookie;
    let cookieValid = false;

    if (cookie) {
      cookieValid = await verifyCookie(account.username, cookie);
    }

    if (!cookieValid) {
      // 重新登录（解密密码）
      const decryptedPassword = decryptSafe(account.password);
      const loginResult = await loginPostcrossing(
        account.username,
        decryptedPassword
      );

      if (!loginResult.success) {
        return {
          success: false,
          message: `登录失败: ${loginResult.error}`,
          error: loginResult.error,
        };
      }

      cookie = loginResult.cookie!;

      // 更新数据库中的 Cookie
      await prisma.postcrossingAccount.update({
        where: { userId },
        data: {
          cookie,
          cookieExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 天
        },
      });
    }

    // 3. 获取 traveling 数据
    const travelingResult = await getTravelingData(account.username, cookie!);

    if (!travelingResult.success) {
      return {
        success: false,
        message: `获取数据失败: ${travelingResult.error}`,
        error: travelingResult.error,
      };
    }

    const traveling = parseTravelingData(travelingResult.data || []);

    // 4. 保存到数据库
    await saveTravelingData(userId, traveling);

    // 5. 更新同步时间
    await prisma.postcrossingAccount.update({
      where: { userId },
      data: { lastSyncAt: new Date() },
    });

    return {
      success: true,
      message: `同步成功，共 ${traveling.length} 张在途明信片`,
      data: {
        travelingCount: traveling.length,
        traveling,
        lastSyncAt: new Date(),
      },
    };
  } catch (error) {
    // console.error("同步错误:", error);
    return {
      success: false,
      message: "同步过程中发生错误",
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}

/**
 * 保存 traveling 数据到数据库
 */
async function saveTravelingData(
  userId: string,
  traveling: TravelingPostcard[]
): Promise<void> {
  // 先删除该用户的旧数据
  await prisma.postcrossingTraveling.deleteMany({
    where: { userId },
  });

  // 插入新数据
  if (traveling.length > 0) {
    await prisma.postcrossingTraveling.createMany({
      data: traveling.map((card) => ({
        userId,
        postcardId: card.postcardId,
        receiverUsername: card.receiverUsername,
        countryCode: card.countryCode,
        sentDate: new Date(card.sentDate),
        distance: card.distance,
        rawData: JSON.stringify(card.rawData),
      })),
    });
  }
}

/**
 * 获取用户的 traveling 数据（从数据库）
 */
export async function getUserTravelingFromDB(userId: string) {
  return prisma.postcrossingTraveling.findMany({
    where: { userId },
    orderBy: { sentDate: "desc" },
  });
}

/**
 * 解密密码（示例，实际应使用加密服务）
 */
export function decryptPassword(encryptedPassword: string): string {
  // TODO: 实现实际的解密逻辑
  return encryptedPassword;
}

/**
 * 加密密码（示例，实际应使用加密服务）
 */
export function encryptPassword(password: string): string {
  // TODO: 实现实际的加密逻辑
  return password;
}
