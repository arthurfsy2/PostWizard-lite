import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import { prisma } from '../prisma';
import { encrypt, decryptSafe } from '../crypto';
import { sanitizeEmailAddressField, sanitizeEmailContent, sanitizeEmailSubject } from '../helpers/emailSanitizer';

/**
 * 将日期转换为 IMAP 搜索格式
 * IMAP 标准要求: "01-Jan-2024" 格式
 * 使用本地时间，因为前端传的 ISO 字符串已经包含时区信息
 */
function formatImapDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // 使用本地时间方法，因为前端传的日期意图是本地日期
  const day = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

// ==================== 类型定义 ====================

export interface EmailConfig {
  imapHost: string;
  imapPort: number;
  imapUsername: string;
  imapPassword: string;
  useTLS: boolean;
  rejectUnauthorized?: boolean;
}

export interface EmailSearchOptions {
  folder?: string;
  limit?: number;
  searchQuery?: string;
  unreadOnly?: boolean;
  postcardId?: string;
  since?: Date;
  before?: Date;  // 新增：结束日期
  onProgress?: (progress: SearchProgress) => void;  // 新增：进度回调
}

export interface SearchProgress {
  stage: 'connecting' | 'searching' | 'fetching' | 'parsing' | 'saving' | 'completed';
  message: string;
  current?: number;
  total?: number;
}

export interface EmailSearchResult {
  uid: string;
  messageId: string;
  subject: string;
  from: string;
  to: string;
  date: Date;
  bodyText: string;
  bodyHtml?: string;
  postcardId?: string;
  recipientName?: string;
  recipientCountry?: string;
  recipientCity?: string;
  recipientAddress?: string;
  recipientAge?: number;
  recipientGender?: string;
  recipientInterests?: string;
}

export interface PostcrossingRecipient {
  postcardId: string;
  recipientName: string;
  recipientCountry: string;
  recipientCity: string;
  recipientAddress?: string;
  recipientAge?: number;
  recipientGender?: string;
  recipientInterests?: string;
}

interface StoredConfig {
  id: string;
  name: string;
  email: string;
  imapHost: string;
  imapPort: number;
  imapUsername: string;
  imapPassword: string;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown;
}

// ==================== 主流邮箱服务商配置 ====================

export const EMAIL_PROVIDERS = {
  qq: {
    name: 'QQ邮箱',
    imap: {
      host: 'imap.qq.com',
      port: 993,
      tls: true,
    },
    authNote: '需要使用授权码（设置 → 账户 → POP3/IMAP/SMTP/Exchange/CardDAV/CalDAV服务 → 生成授权码）',
  },
  gmail: {
    name: 'Gmail',
    imap: {
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
    },
    authNote: '需要开启"允许不够安全的应用访问"或使用应用专用密码',
  },
  outlook: {
    name: 'Outlook/Hotmail',
    imap: {
      host: 'outlook.office365.com',
      port: 993,
      tls: true,
    },
    authNote: '使用邮箱地址和密码',
  },
  '163': {
    name: '163邮箱',
    imap: {
      host: 'imap.163.com',
      port: 993,
      tls: true,
    },
    authNote: '需要使用授权码（设置 → POP3/SMTP/IMAP → 开启IMAP服务 → 生成授权码）',
  },
  '126': {
    name: '126邮箱',
    imap: {
      host: 'imap.126.com',
      port: 993,
      tls: true,
    },
    authNote: '需要使用授权码',
  },
  yahoo: {
    name: 'Yahoo Mail',
    imap: {
      host: 'imap.mail.yahoo.com',
      port: 993,
      tls: true,
    },
    authNote: '需要生成应用密码',
  },
} as const;

export type EmailProvider = keyof typeof EMAIL_PROVIDERS;

// ==================== IMAP 连接器 ====================

/**
 * 创建 IMAP 连接
 */
function createImapConnection(config: EmailConfig): Imap {
  // QQ邮箱需要禁用TLS证书验证
  const isQQMail = config.imapHost?.includes('qq.com');
  
  return new Imap({
    user: config.imapUsername,
    password: config.imapPassword,
    host: config.imapHost,
    port: config.imapPort,
    tls: config.useTLS,
    tlsOptions: {
      // 开发环境：对 QQ 邮箱和 Gmail 禁用证书验证
      rejectUnauthorized: (isQQMail || config.imapHost?.includes('gmail.com')) ? false : (config.rejectUnauthorized ?? true),
    },
    connTimeout: 30000,
    authTimeout: 30000,
  });
}

/**
 * 搜索邮件 UID 列表
 */
function searchEmails(imap: Imap, criteria: unknown[]): Promise<number[]> {
  return new Promise((resolve, reject) => {
    imap.search(criteria, (err, results) => {
      if (err) reject(err);
      else resolve(results.map(r => Number(r)));
    });
  });
}

/**
 * 获取邮件内容
 */
function fetchEmails(imap: Imap, uids: number[]): Promise<ParsedMail[]> {
  return new Promise((resolve, reject) => {
    const emails: ParsedMail[] = [];
    let pendingParses = 0;
    let messageCount = 0;
    let fetchEnded = false;
    
    // console.log('[IMAP Debug] fetchEmails 被调用，UIDs:', uids);
    
    if (uids.length === 0) {
      // console.log('[IMAP Debug] uids 为空，直接返回');
      resolve([]);
      return;
    }

    const fetch = imap.fetch(uids, { bodies: '' });
    
    fetch.on('error', (err: any) => {
      // console.log('[IMAP Debug] fetch 错误:', err.message);
      reject(err);
    });
    
    const checkComplete = () => {
      if (fetchEnded && pendingParses === 0) {
        // console.log('[IMAP Debug] 所有邮件解析完成，共', emails.length, '封');
        resolve(emails);
      }
    };
    
    fetch.on('message', (msg) => {
      messageCount++;
      pendingParses++;
      // console.log('[IMAP Debug] 收到消息 #' + messageCount + ', 待解析:', pendingParses);
      let buffer = '';
      
      msg.on('body', (stream) => {
        stream.on('data', (chunk) => {
          buffer += chunk.toString('utf8');
        });
      });
      
      msg.on('end', async () => {
        try {
          // console.log('[IMAP Debug] 开始解析邮件 #' + messageCount);
          const parsed = await simpleParser(buffer);
          emails.push(parsed);
          // console.log('[IMAP Debug] 解析成功，当前邮件数:', emails.length);
        } catch (e: any) {
          // console.log('[IMAP Debug] 解析邮件失败:', e.message);
        } finally {
          pendingParses--;
          // console.log('[IMAP Debug] 剩余待解析:', pendingParses);
          checkComplete();
        }
      });
    });
    
    fetch.once('end', () => {
      fetchEnded = true;
      // console.log('[IMAP Debug] fetch 结束，共收到', messageCount, '条消息，待解析:', pendingParses);
      checkComplete();
    });
  });
}

/**
 * 打开邮箱文件夹
 */
function openBox(imap: Imap, boxName: string = 'INBOX'): Promise<Imap.Box> {
  return new Promise((resolve, reject) => {
    imap.openBox(boxName, false, (err, box) => {
      if (err) reject(err);
      else resolve(box);
    });
  });
}

// ==================== Postcrossing 邮件解析器 ====================

/**
 * 从邮件主题提取明信片 ID
 * 格式: "Postcrossing - CN-1234567" 或 "CN-1234567"
 */
export function extractPostcardId(subject: string): string | null {
  // 支持多种格式
  const patterns = [
    /([A-Z]{2}-\d{6,8})/i,                    // CN-1234567
    /postcard[:\s]*([A-Z]{2}-\d{6,8})/i,      // Postcard: CN-1234567
    /ID[:\s]*([A-Z]{2}-\d{6,8})/i,            // ID: CN-1234567
  ];
  
  for (const pattern of patterns) {
    const match = subject.match(pattern);
    if (match) {
      return match[1].toUpperCase();
    }
  }
  
  return null;
}

/**
 * 解析 Postcrossing 邮件内容，提取收件人信息
 */
export function parsePostcrossingEmail(
  subject: string,
  bodyText: string,
  bodyHtml?: string
): PostcrossingRecipient | null {
  // 1. 提取明信片 ID
  const postcardId = extractPostcardId(subject);
  if (!postcardId) {
    return null;
  }
  
  // 使用 HTML 或纯文本解析
  const content = bodyHtml || bodyText;
  
  // 2. 提取收件人信息
  const recipient: PostcrossingRecipient = {
    postcardId,
    recipientName: '',
    recipientCountry: '',
    recipientCity: '',
  };
  
  // 解析姓名 - 多种模式
  const namePatterns = [
    /(?:name|姓名|收件人)[:：\s]*([^\n\r<]+)/i,
    /to[:：\s]+([^\n\r<]+)/i,
    /send(?:ing)?\s+to[:：\s]+([^\n\r<]+)/i,
    /recipient[:：\s]+([^\n\r<]+)/i,
  ];
  
  for (const pattern of namePatterns) {
    const match = content.match(pattern);
    if (match) {
      recipient.recipientName = match[1].trim();
      break;
    }
  }
  
  // 解析国家
  const countryPatterns = [
    /(?:country|国家)[:：\s]*([^\n\r,]+)/i,
    /lives\s+in\s+([^\n\r,]+)/i,
    /from[:：\s]+([^\n\r,]+)/i,
    /location[:：\s]+([^\n\r,]+)/i,
  ];
  
  for (const pattern of countryPatterns) {
    const match = content.match(pattern);
    if (match) {
      recipient.recipientCountry = match[1].trim();
      break;
    }
  }
  
  // 解析城市
  const cityPatterns = [
    /(?:city|城市)[:：\s]*([^\n\r,]+)/i,
    /lives\s+in\s+([^,]+),\s*([^\n\r]+)/i,  // city, country
  ];
  
  const cityMatch = content.match(/(?:city|城市)[:：\s]*([^\n\r,]+)/i);
  if (cityMatch) {
    recipient.recipientCity = cityMatch[1].trim();
  }
  
  // 解析地址
  const addressMatch = content.match(/(?:address|地址)[:：\s]*([^\n\r]+)/i);
  if (addressMatch) {
    recipient.recipientAddress = addressMatch[1].trim();
  }
  
  // 解析年龄
  const ageMatch = content.match(/(?:age|年龄)[:：\s]*(\d+)/i);
  if (ageMatch) {
    recipient.recipientAge = parseInt(ageMatch[1], 10);
  }
  
  // 解析性别
  const genderMatch = content.match(/(?:gender|性别)[:：\s]*(\w+)/i);
  if (genderMatch) {
    recipient.recipientGender = genderMatch[1].trim();
  }
  
  // 解析兴趣
  const interestsPatterns = [
    /(?:interests?|爱好|likes?)[:：\s]*([^\n\r]+)/i,
    /about\s+(?:him|her|them)[:：\s]*([^\n\r]+)/i,
  ];
  
  for (const pattern of interestsPatterns) {
    const match = content.match(pattern);
    if (match) {
      recipient.recipientInterests = match[1].trim();
      break;
    }
  }
  
  return recipient;
}

/**
 * 检查是否为 Postcrossing 邮件
 */
export function isPostcrossingEmail(email: ParsedMail): boolean {
  const from = email.from?.value?.[0]?.address?.toLowerCase() || '';
  const subject = email.subject || '';
  
  // 检查发件人
  if (from.includes('postcrossing.com')) {
    return true;
  }
  
  // 检查主题包含明信片 ID
  if (extractPostcardId(subject)) {
    return true;
  }
  
  return false;
}

// ==================== EmailService 类 ====================

/**
 * 邮箱服务类
 */
export class EmailService {
  /**
   * 添加配置（数据库存储）
   */
  async addConfig(config: any & { userId?: string }): Promise<StoredConfig> {
    // 加密密码
    const encryptedPass = config.imapPassword || config.imapPass ? encrypt(config.imapPassword || config.imapPass) : '';
    
    const saved = await prisma.emailConfig.create({
      data: {
        userId: config.userId,
        provider: config.name || config.provider || 'custom',
        email: config.email,
        imapHost: config.imapHost,
        imapPort: config.imapPort,
        imapUser: config.imapUsername || config.imapUser,
        imapPass: encryptedPass,
        isActive: config.isActive ?? true,
      },
    });
    
    return this.mapPrismaToStored(saved);
  }

  /**
   * 获取单个配置
   */
  async getConfig(id: string): Promise<StoredConfig | null> {
    const config = await prisma.emailConfig.findUnique({
      where: { id },
    });
    
    if (!config) return null;
    return this.mapPrismaToStored(config);
  }

  /**
   * 获取所有配置
   */
  async getAllConfigs(userId?: string): Promise<StoredConfig[]> {
    const configs = await prisma.emailConfig.findMany({
      where: userId ? { userId } : {},
      orderBy: { createdAt: 'desc' },
    });
    
    return configs.map(config => this.mapPrismaToStored(config));
  }

  /**
   * 更新配置
   */
  async updateConfig(id: string, updates: Partial<StoredConfig>): Promise<StoredConfig | null> {
    const { userId, name, imapUsername, imapPassword, ...rest } = updates;
    
    // 映射字段名
    const updateData: any = { ...rest };
    if (name !== undefined) updateData.provider = name;
    if (imapUsername !== undefined) updateData.imapUser = imapUsername;
    // 加密密码
    if (imapPassword !== undefined) {
      updateData.imapPass = encrypt(imapPassword);
    }
    
    const updated = await prisma.emailConfig.update({
      where: { id },
      data: updateData,
    });
    
    return this.mapPrismaToStored(updated);
  }

  /**
   * 删除配置
   */
  async deleteConfig(id: string): Promise<boolean> {
    try {
      await prisma.emailConfig.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      // console.error('删除配置失败:', error);
      return false;
    }
  }

  /**
   * 将 Prisma 对象转换为 StoredConfig
   */
  private mapPrismaToStored(prismaConfig: any): StoredConfig {
    return {
      id: prismaConfig.id,
      name: prismaConfig.provider,
      email: prismaConfig.email,
      imapHost: prismaConfig.imapHost,
      imapPort: prismaConfig.imapPort,
      imapUsername: prismaConfig.imapUser,
      // 解密密码（双轨兼容）
      imapPassword: decryptSafe(prismaConfig.imapPass),
      useTLS: true,
      rejectUnauthorized: true,
      isActive: prismaConfig.isActive,
      folderPath: prismaConfig.folderPath || '',
      createdAt: prismaConfig.createdAt,
      updatedAt: prismaConfig.updatedAt,
    };
  }

  /**
   * 验证连接（使用增强版测试）
   */
  async verifyConnection(configId: string): Promise<{ success: boolean; error?: string; details?: string }> {
    const config = this.configs.get(configId);
    if (!config) {
      return { success: false, error: '配置不存在' };
    }
    
    const result = await this.testImapConnection({
      imapHost: config.imapHost,
      imapPort: config.imapPort,
      imapUsername: config.imapUsername,
      imapPassword: config.imapPassword,
      useTLS: config.useTLS ?? true,
      rejectUnauthorized: config.rejectUnauthorized ?? true,
    });
    
    return {
      success: result.success,
      error: result.error,
      details: result.details,
    };
  }

  /**
   * 测试 IMAP 连接（增强版）
   * 返回详细的连接状态和错误信息
   */
  async testImapConnection(config: EmailConfig): Promise<{
    success: boolean;
    error?: string;
    errorCode?: string;
    details?: string;
    provider?: string;
  }> {
    return new Promise((resolve) => {
      const imap = createImapConnection(config);
      
      // 识别邮箱服务商
      let provider = 'unknown';
      for (const [key, value] of Object.entries(EMAIL_PROVIDERS)) {
        if (config.imapHost.includes(value.imap.host)) {
          provider = key;
          break;
        }
      }

      const timeout = setTimeout(() => {
        imap.destroy();
        resolve({
          success: false,
          error: '连接超时',
          errorCode: 'TIMEOUT',
          details: '连接邮箱服务器超时，请检查网络连接和邮箱配置',
          provider,
        });
      }, 15000);

      imap.once('ready', () => {
        clearTimeout(timeout);
        
        // 尝试打开 INBOX 验证权限
        imap.openBox('INBOX', true, (err, box) => {
          imap.end();
          
          if (err) {
            resolve({
              success: false,
              error: '无法访问收件箱',
              errorCode: 'ACCESS_DENIED',
              details: err.message,
              provider,
            });
          } else {
            resolve({
              success: true,
              provider,
              details: `成功连接到 ${EMAIL_PROVIDERS[provider as EmailProvider]?.name || provider}，共有 ${box.messages.total} 封邮件`,
            });
          }
        });
      });

      imap.once('error', (err) => {
        clearTimeout(timeout);
        
        // 解析错误类型
        let errorCode = 'UNKNOWN_ERROR';
        let errorMessage = '连接失败';
        let errorDetails = err.message;

        if (err.message.includes('Invalid credentials') || 
            err.message.includes('login failed') ||
            err.message.includes('authentication failed')) {
          errorCode = 'AUTH_FAILED';
          errorMessage = '认证失败';
          errorDetails = '邮箱地址或密码错误，请检查邮箱配置';
          
          // 添加服务商特定提示
          if (provider === 'qq' || provider === '163' || provider === '126') {
            errorDetails += '。注意：国内邮箱需要使用授权码而非登录密码';
          } else if (provider === 'gmail') {
            errorDetails += '。注意：Gmail 需要开启"允许不够安全的应用访问"或使用应用专用密码';
          }
        } else if (err.message.includes('ENOTFOUND') || err.message.includes('getaddrinfo')) {
          errorCode = 'HOST_NOT_FOUND';
          errorMessage = '无法解析邮箱服务器地址';
          errorDetails = `无法找到 ${config.imapHost}，请检查 IMAP 服务器地址`;
        } else if (err.message.includes('ECONNREFUSED')) {
          errorCode = 'CONNECTION_REFUSED';
          errorMessage = '连接被拒绝';
          errorDetails = `无法连接到 ${config.imapHost}:${config.imapPort}，请检查端口是否正确`;
        } else if (err.message.includes('ETIMEDOUT')) {
          errorCode = 'NETWORK_TIMEOUT';
          errorMessage = '网络超时';
          errorDetails = '网络连接超时，请检查网络连接';
        } else if (err.message.includes('SSL') || err.message.includes('TLS')) {
          errorCode = 'SSL_ERROR';
          errorMessage = 'SSL/TLS 错误';
          errorDetails = 'SSL/TLS 握手失败，请检查是否启用了 TLS';
        }

        resolve({
          success: false,
          error: errorMessage,
          errorCode,
          details: errorDetails,
          provider,
        });
      });

      imap.connect();
    });
  }

  /**
   * 获取邮件完整内容（用于解析）- 带循环下载机制
   * 容错策略：
   * 1. 批量下载（每批 50 封），避免单次超时
   * 2. 循环下载：如果某轮下载不完整，自动重试
   * 3. 记录失败的 UID，返回给调用方处理
   * 4. 支持增量下载（只下载未下载的邮件）
   */
  async fetchEmailFullContent(
    configId: string,
    uids: number[],
    folder: string = 'INBOX',
    onProgress?: (current: number, total: number) => void,
    options?: {
      batchSize?: number; // 每批数量，默认 50
      maxRetries?: number; // 最大重试次数，默认 3
      maxRounds?: number; // 最大下载轮次，默认 5
    }
  ): Promise<{ emails: ParsedMail[]; failedUids: number[]; successCount: number }> {
    const emailConfig = await this.getConfig(configId);
    if (!emailConfig) {
      throw new Error('邮箱配置不存在');
    }

    const config: EmailConfig = {
      imapHost: emailConfig.imapHost,
      imapPort: emailConfig.imapPort,
      imapUsername: (emailConfig as any).imapUser || emailConfig.imapUsername,
      imapPassword: (emailConfig as any).imapPass || emailConfig.imapPassword,
      useTLS: true,
      rejectUnauthorized: false,
    };

    const batchSize = options?.batchSize || 10; // 减小批次到 10 封
    const maxRounds = options?.maxRounds || 3;
    const allEmails: ParsedMail[] = [];
    const failedUids: number[] = [];
    const processedUids = new Set<number>(); // 已处理的 UID
    let totalSuccess = 0;

    console.log(`[fetchEmailFullContent] 开始下载，总 UID 数：${uids.length}`);

    // 循环下载，直到所有邮件都被下载或达到最大轮次
    for (let round = 1; round <= maxRounds; round++) {
      // 计算本轮需要下载的 UID（排除已处理的）
      const uidsToFetch = uids.filter(uid => !processedUids.has(uid));
      
      if (uidsToFetch.length === 0) {
        console.log(`[fetchEmailFullContent] 第 ${round} 轮：所有邮件已下载完成`);
        break;
      }

      console.log(`[fetchEmailFullContent] 第 ${round} 轮：需要下载 ${uidsToFetch.length} 封邮件`);

      // 分批下载邮件
      const batches = [];
      for (let i = 0; i < uidsToFetch.length; i += batchSize) {
        batches.push(uidsToFetch.slice(i, i + batchSize));
      }

      let roundSuccess = 0;
      let roundFailed: number[] = [];

      // 下载当前批次
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batchUids = batches[batchIndex];
        
        try {
          console.log(`[fetchEmailFullContent] 批次 ${batchIndex + 1}/${batches.length}, UIDs: ${batchUids.length}`);
          const batchEmails = await this.fetchBatchEmailsWithUidTracking(config, batchUids, folder);
          
          console.log(`[fetchEmailFullContent] 批次 ${batchIndex + 1} 成功，下载 ${batchEmails.emails.length} 封，失败 ${batchEmails.failedUids.length} 封`);
          
          // 保存成功的邮件
          allEmails.push(...batchEmails.emails);
          roundSuccess += batchEmails.emails.length;
          totalSuccess += batchEmails.emails.length;
          
          // 标记已处理的 UID
          batchEmails.emails.forEach(email => {
            if (email.uid) {
              processedUids.add(email.uid);
            }
          });
          
          // 记录失败的 UID
          if (batchEmails.failedUids.length > 0) {
            roundFailed.push(...batchEmails.failedUids);
            console.log(`[fetchEmailFullContent] 批次 ${batchIndex + 1} 失败 UID: ${batchEmails.failedUids.join(', ')}`);
          }
          
          // 更新进度
          onProgress?.(totalSuccess, uids.length);
        } catch (error: any) {
          console.error(`[fetchEmailFullContent] 批次 ${batchIndex + 1} 异常:`, error.message);
          // 整批失败，记录所有 UID
          roundFailed.push(...batchUids);
        }
      }

      console.log(`[fetchEmailFullContent] 第 ${round} 轮完成：成功 ${roundSuccess} 封，失败 ${roundFailed.length} 封`);

      // 如果本轮没有失败的，提前结束
      if (roundFailed.length === 0) {
        console.log(`[fetchEmailFullContent] 所有邮件下载完成，共 ${totalSuccess} 封`);
        break;
      }

      // 如果还有失败的 UID，准备下一轮重试
      failedUids.push(...roundFailed);
      console.log(`[fetchEmailFullContent] 将在 ${round < maxRounds ? '下一轮' : '结束后'} 处理失败的 ${roundFailed.length} 封邮件`);
      
      // 如果不是最后一轮，等待一下
      if (round < maxRounds) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`[fetchEmailFullContent] 全部完成：totalSuccess=${totalSuccess}, failedUids=${failedUids.length}, allEmails=${allEmails.length}`);

    return { emails: allEmails, failedUids, successCount: totalSuccess };
  }

  /**
   * 获取单批邮件（带 UID 追踪）
   */
  private async fetchBatchEmailsWithUidTracking(
    config: EmailConfig,
    uids: number[],
    folder: string
  ): Promise<{ emails: ParsedMail[]; failedUids: number[] }> {
    return new Promise((resolve, reject) => {
      const imap = createImapConnection(config);
      const emails: ParsedMail[] = [];
      const receivedUids = new Set<number>(); // 实际收到的 UID
      const failedUids: number[] = [];
      let processedCount = 0;
      const timeout = setTimeout(() => {
        imap.destroy();
        reject(new Error(`获取超时 (${uids.length} 封邮件)`));
      }, 60000);

      imap.once('ready', () => {
        try {
          imap.openBox(folder, true, (err) => {
            if (err) {
              clearTimeout(timeout);
              imap.end();
              reject(err);
              return;
            }

            // 使用 UID 方式获取邮件
            const fetch = imap.fetch(uids, { bodies: '', markSeen: false });
            
            fetch.on('message', (msg) => {
              // 直接使用 msg.uid 属性（imap 库会提供）
              const uid = msg.uid;
              console.log(`[fetchBatchEmails] 收到邮件 UID: ${uid}`);
              
              if (uid) {
                receivedUids.add(uid);
              }
              
              let buffer = '';
              
              msg.on('body', (stream) => {
                stream.on('data', (chunk) => {
                  buffer += chunk.toString('utf8');
                });
              });
              
              msg.on('end', async () => {
                try {
                  const parsed = await simpleParser(buffer);
                  (parsed as any).uid = uid;
                  emails.push(parsed);
                  processedCount++;
                } catch (e: any) {
                  console.error(`[fetchBatchEmails] UID ${uid} 解析失败:`, e.message);
                  if (uid) {
                    failedUids.push(uid);
                  }
                  processedCount++;
                }
              });
            });
            
            fetch.once('end', () => {
              // 计算缺失的 UID
              const missingUids = uids.filter(uid => !receivedUids.has(uid));
              if (missingUids.length > 0) {
                console.warn(`[fetchBatchEmails] ⚠️ 缺失 ${missingUids.length} 封邮件，UID: ${missingUids.slice(0, 10).join(', ')}${missingUids.length > 10 ? '...' : ''}`);
                failedUids.push(...missingUids);
              }
              
              console.log(`[fetchBatchEmails] 批次结束：请求 ${uids.length} 封，收到 ${receivedUids.size} 封，解析 ${emails.length} 封，失败 ${failedUids.length} 封`);
              clearTimeout(timeout);
              imap.end();
              resolve({ emails, failedUids });
            });
          });
        } catch (error: any) {
          clearTimeout(timeout);
          imap.end();
          reject(error);
        }
      });

      imap.once('error', (err) => {
        clearTimeout(timeout);
        imap.end();
        reject(err);
      });

      imap.connect();
    });
  }

  /**
   * 获取单批邮件
   */
  private async fetchBatchEmails(
    config: EmailConfig,
    uids: number[],
    folder: string
  ): Promise<ParsedMail[]> {
    return new Promise((resolve, reject) => {
      const imap = createImapConnection(config);
      const emails: ParsedMail[] = [];
      let processedCount = 0; // ✅ 添加计数
      const timeout = setTimeout(() => {
        imap.destroy();
        reject(new Error(`获取超时 (${uids.length} 封邮件)`));
      }, 60000); // 60 秒超时

      imap.once('ready', () => {
        try {
          // 打开指定文件夹
          imap.openBox(folder, true, (err) => {
            if (err) {
              clearTimeout(timeout);
              imap.end();
              reject(err);
              return;
            }

            // 获取完整邮件内容
            const fetch = imap.fetch(uids, { bodies: '', markSeen: false });
            
            let messageCount = 0;
            fetch.on('message', (msg) => {
              messageCount++;
              const seqno = msg.seqno;
              console.log(`[fetchBatchEmails] 收到邮件 ${messageCount}, SeqNo: ${seqno}`);
              let buffer = '';
              
              msg.on('body', (stream) => {
                stream.on('data', (chunk) => {
                  buffer += chunk.toString('utf8');
                });
              });
              
              msg.on('end', async () => {
                try {
                  const parsed = await simpleParser(buffer);
                  emails.push(parsed);
                  console.log(`[fetchBatchEmails] ✅ SeqNo ${seqno} 解析成功`);
                  processedCount++;
                } catch (e: any) {
                  console.error(`[fetchBatchEmails] ❌ SeqNo ${seqno} 解析失败:`, e.message);
                  processedCount++;
                }
              });
            });
            
            fetch.once('end', () => {
              console.log(`[fetchBatchEmails] 批次结束：收到 ${messageCount} 封邮件，解析 ${emails.length} 封`);
              clearTimeout(timeout);
              imap.end();
              resolve(emails);
            });
          });
        } catch (error: any) {
          clearTimeout(timeout);
          imap.end();
          reject(error);
        }
      });

      imap.once('error', (err) => {
        clearTimeout(timeout);
        imap.end();
        reject(err);
      });

      imap.connect();
    });
  }

  /**
   * 获取邮件 Headers（用于提取 postcardId，不下载完整内容）
   */
  async fetchEmailHeaders(
    configId: string,
    uids: number[],
    folder: string = 'INBOX'
  ): Promise<Array<{ uid: number; messageId: string; subject: string; date: Date }>> {
    const emailConfig = await this.getConfig(configId);
    if (!emailConfig) {
      throw new Error('邮箱配置不存在');
    }

    const config: EmailConfig = {
      imapHost: emailConfig.imapHost,
      imapPort: emailConfig.imapPort,
      imapUsername: (emailConfig as any).imapUser || emailConfig.imapUsername,
      imapPassword: (emailConfig as any).imapPass || emailConfig.imapPassword,
      useTLS: true,
      rejectUnauthorized: false,
    };

    return new Promise((resolve, reject) => {
      const imap = createImapConnection(config);
      const results: Array<{ uid: number; messageId: string; subject: string; date: Date }> = [];
      const timeout = setTimeout(() => {
        imap.destroy();
        reject(new Error('获取超时'));
      }, 30000);

      imap.once('ready', () => {
        try {
          // 打开指定文件夹
          imap.openBox(folder, true, (err) => {
            if (err) {
              clearTimeout(timeout);
              imap.end();
              reject(err);
              return;
            }

            // 获取邮件 headers
            const fetch = imap.fetch(uids, { bodies: 'HEADER.FIELDS (SUBJECT MESSAGE-ID DATE)', markSeen: false });
            
            fetch.on('message', (msg) => {
              const result: any = { uid: msg.seqno };
              
              msg.on('body', (stream) => {
                simpleParser(stream, (err, parsed) => {
                  if (!err && parsed) {
                    result.messageId = parsed.messageId || '';
                    result.subject = parsed.subject || '';
                    result.date = parsed.date || new Date();
                    results.push(result);
                  }
                });
              });
            });
            
            fetch.once('end', () => {
              clearTimeout(timeout);
              imap.end();
              resolve(results);
            });
          });
        } catch (error: any) {
          clearTimeout(timeout);
          imap.end();
          reject(error);
        }
      });

      imap.once('error', (err) => {
        clearTimeout(timeout);
        imap.end();
        reject(err);
      });

      imap.connect();
    });
  }

  /**
   * 搜索邮件 UID 列表（不下载内容）
   */
  async searchEmailUids(
    configId: string,
    options?: { folder?: string; searchQuery?: string }
  ): Promise<number[]> {
    const emailConfig = await this.getConfig(configId);
    if (!emailConfig) {
      throw new Error('邮箱配置不存在');
    }

    const config: EmailConfig = {
      imapHost: emailConfig.imapHost,
      imapPort: emailConfig.imapPort,
      imapUsername: (emailConfig as any).imapUser || emailConfig.imapUsername,
      imapPassword: (emailConfig as any).imapPass || emailConfig.imapPassword,
      useTLS: true,
      rejectUnauthorized: false,
    };

    return new Promise((resolve, reject) => {
      const imap = createImapConnection(config);
      const timeout = setTimeout(() => {
        imap.destroy();
        reject(new Error('搜索超时'));
      }, 30000);

      imap.once('ready', async () => {
        try {
          // 打开邮箱文件夹
          const folder = options?.folder || 'INBOX';
          await openBox(imap, folder);

          // 构建搜索条件
          const criteria: any[] = [];
          const queryText = options?.searchQuery || 'Postcrossing';
          criteria.push(['SUBJECT', queryText]);

          // 搜索邮件（只获取 UID 列表）
          const uids = await searchEmails(imap, criteria);
          
          clearTimeout(timeout);
          imap.end();
          resolve(uids);
        } catch (error: any) {
          clearTimeout(timeout);
          imap.end();
          reject(error);
        }
      });

      imap.once('error', (err) => {
        clearTimeout(timeout);
        imap.end();
        reject(err);
      });

      imap.connect();
    });
  }

  /**
   * 统计邮件数量（只获取 UID 列表，不下载内容）
   */
  async countEmails(
    configId: string,
    options?: { folder?: string; searchQuery?: string }
  ): Promise<number> {
    const emailConfig = await this.getConfig(configId);
    if (!emailConfig) {
      throw new Error('邮箱配置不存在');
    }

    const config: EmailConfig = {
      imapHost: emailConfig.imapHost,
      imapPort: emailConfig.imapPort,
      imapUsername: (emailConfig as any).imapUser || emailConfig.imapUsername,
      imapPassword: (emailConfig as any).imapPass || emailConfig.imapPassword,
      useTLS: true,
      rejectUnauthorized: false,
    };

    return new Promise((resolve, reject) => {
      const imap = createImapConnection(config);
      const timeout = setTimeout(() => {
        imap.destroy();
        reject(new Error('统计超时'));
      }, 30000);

      imap.once('ready', async () => {
        try {
          // 打开邮箱文件夹
          const folder = options?.folder || 'INBOX';
          await openBox(imap, folder);

          // 构建搜索条件
          const criteria: any[] = [];
          const queryText = options?.searchQuery || 'Postcrossing';
          criteria.push(['SUBJECT', queryText]);

          // 搜索邮件（只获取 UID 列表）
          const uids = await searchEmails(imap, criteria);
          
          clearTimeout(timeout);
          imap.end();
          resolve(uids.length);
        } catch (error: any) {
          clearTimeout(timeout);
          imap.end();
          reject(error);
        }
      });

      imap.once('error', (err) => {
        clearTimeout(timeout);
        imap.end();
        reject(err);
      });

      imap.connect();
    });
  }

  /**
   * 搜索 Postcrossing 邮件（真实 IMAP 实现，支持进度回调）
   */
  async searchPostcrossingEmails(
    configId: string,
    options?: EmailSearchOptions
  ): Promise<EmailSearchResult[]> {
    const emailConfig = await this.getConfig(configId);

    if (!emailConfig) {
      throw new Error('邮箱配置不存在');
    }

    const config: EmailConfig = {
      imapHost: emailConfig.imapHost,
      imapPort: emailConfig.imapPort,
      imapUsername: (emailConfig as any).imapUser || emailConfig.imapUsername,
      imapPassword: (emailConfig as any).imapPass || emailConfig.imapPassword,
      useTLS: true,
      rejectUnauthorized: false,  // QQ 邮箱需要禁用证书验证
    };

    const progressCallback = options?.onProgress;

    return new Promise((resolve, reject) => {
      const imap = createImapConnection(config);
      const results: EmailSearchResult[] = [];

      // 进度回调：正在连接
      progressCallback?.({
        stage: 'connecting',
        message: '正在连接邮箱服务器...',
      });

      const timeout = setTimeout(() => {
        imap.destroy();
        reject(new Error('搜索超时'));
      }, 60000);

      imap.once('ready', async () => {
        try {
          // 进度回调：正在搜索
          progressCallback?.({
            stage: 'searching',
            message: '正在搜索邮件...',
          });
          
          // 打开邮箱文件夹
          const folder = options?.folder || 'INBOX';
          try {
            await openBox(imap, folder);
          } catch (err: any) {
            imap.end();
            reject(new Error(`文件夹 "${folder}" 不存在或无法访问: ${err.message}`));
            return;
          }

          // 构建搜索条件
          const criteria: any[] = [];
          
          // 搜索关键词：优先使用传入的 searchQuery，默认使用 "Postcrossing"
          // - /emails 页面：使用默认的 "Postcrossing"
          // - /arrivals 页面：使用 "Hurray! Your postcard"（抵达确认邮件）
          const queryText = options?.searchQuery || 'Postcrossing';
          criteria.push(['SUBJECT', queryText]);
          
          // 未读邮件（可选）
          if (options?.unreadOnly) {
            criteria.push('UNSEEN');
          }
          
          // 指定明信片 ID（可选）
          if (options?.postcardId) {
            criteria.push(['SUBJECT', options.postcardId]);
          }

          // 调试日志
          console.log('[IMAP Debug] 搜索文件夹:', folder);
          console.log('[IMAP Debug] 搜索条件:', JSON.stringify(criteria));
          console.log('[IMAP Debug] options.searchQuery:', options?.searchQuery);
          console.log('[IMAP Debug] queryText:', queryText);
          
          // 测试日期格式转换
          if (options?.since) {
            const testSince = new Date(options.since);
            // console.log('[IMAP Debug] sinceDate 对象:', testSince);
            // console.log('[IMAP Debug] sinceDate UTC:', testSince.toISOString());
            // console.log('[IMAP Debug] since IMAP format:', formatImapDate(testSince));
          }
          if (options?.before) {
            const testBefore = new Date(options.before);
            // console.log('[IMAP Debug] beforeDate 对象:', testBefore);
            // console.log('[IMAP Debug] beforeDate UTC:', testBefore.toISOString());
            // console.log('[IMAP Debug] before IMAP format:', formatImapDate(testBefore));
          }

          // 搜索邮件
          const uids = await searchEmails(imap, criteria);
          // console.log('[IMAP Debug] 搜索到的邮件 UID 数量:', uids.length);
          
          // 限制数量
          const limit = options?.limit || 20;
          const limitedUids = uids.slice(-limit);
          
          // console.log('[IMAP Debug] 限制后取最后的', limit, '封，UIDs:', limitedUids.length);
          
          if (limitedUids.length === 0) {
            // 测试不带日期限制
            // console.log('[IMAP Debug] 结果为空，测试不带日期限制...');
            const noDateCriteria = [['SUBJECT', 'Postcrossing']];
            const noDateUids = await searchEmails(imap, noDateCriteria);
            // console.log('[IMAP Debug] 不带日期限制的 Postcrossing 邮件数:', noDateUids.length);
            
            // 获取最新一封的详情
            if (noDateUids.length > 0) {
              const latestUids = noDateUids.slice(-1);
              try {
                const testEmails = await fetchEmails(imap, latestUids);
                if (testEmails.length > 0) {
                  // console.log('[IMAP Debug] 最新邮件主题:', testEmails[0].subject);
                  // console.log('[IMAP Debug] 最新邮件日期:', testEmails[0].date);
                }
              } catch (fetchErr: any) {
                // console.log('[IMAP Debug] 获取失败:', fetchErr.message);
              }
            }
            
            imap.end();
            progressCallback?.({
              stage: 'completed',
              message: '未找到符合条件的邮件',
              current: 0,
              total: 0,
            });
            resolve([]);
            return;
          }

          // 进度回调：正在获取邮件
          progressCallback?.({
            stage: 'fetching',
            message: `正在获取 ${limitedUids.length} 封邮件...`,
            current: 0,
            total: limitedUids.length,
          });

          // 获取邮件内容
          const emails = await fetchEmails(imap, limitedUids);
          
          // 进度回调：正在解析
          progressCallback?.({
            stage: 'parsing',
            message: '正在解析邮件内容...',
            current: 0,
            total: emails.length,
          });
          
          // 解析并转换结果
          const searchQuery = options?.searchQuery?.toLowerCase();
          
          // 辅助函数：安全获取发件人文本
          const getFromText = (from: any): string => {
            if (!from) return '';
            if (typeof from === 'string') return from;
            if (Array.isArray(from)) {
              return from.map(f => typeof f === 'string' ? f : (f.text || f.address || '')).join(', ');
            }
            return from.text || from.address || '';
          };
          
          for (let i = 0; i < emails.length; i++) {
            const email = emails[i];
            
            // 如果有搜索关键词，过滤邮件
            if (searchQuery) {
              const subject = (email.subject || '').toLowerCase();
              const from = getFromText(email.from).toLowerCase();
              const text = (email.text || '').toLowerCase();
              if (!subject.includes(searchQuery) && 
                  !from.includes(searchQuery) && 
                  !text.includes(searchQuery)) {
                continue;
              }
            }
            
            const recipient = parsePostcrossingEmail(
              email.subject || '',
              email.text || '',
              email.html || undefined
            );
            
            // 处理 AddressObject 或 AddressObject[] 类型
            const toText = Array.isArray(email.to) 
              ? email.to.map(a => a.text).join(', ') 
              : email.to?.text || '';

            const emailDate = email.date || new Date();
            
            // 客户端日期过滤（作为 IMAP 服务器端过滤的后备）
            if (options?.since || options?.before) {
              const sinceTime = options?.since ? new Date(options.since).getTime() : 0;
              const beforeTime = options?.before ? new Date(options.before).getTime() : Infinity;
              const emailTime = emailDate.getTime();
              const beforeEndTime = beforeTime + 24 * 60 * 60 * 1000 - 1;
              
              // 调试：第一封邮件的日期信息
              if (i === 0) {
                // console.log('[IMAP Debug] 日期过滤调试:');
                // console.log('[IMAP Debug]   since:', options?.since, '->', new Date(sinceTime).toISOString());
                // console.log('[IMAP Debug]   before:', options?.before, '->', new Date(beforeTime).toISOString());
                // console.log('[IMAP Debug]   邮件日期:', emailDate.toISOString());
                // console.log('[IMAP Debug]   邮件时间戳:', emailTime);
                // console.log('[IMAP Debug]   范围:', sinceTime, '-', beforeEndTime);
                // console.log('[IMAP Debug]   是否在范围内:', emailTime >= sinceTime && emailTime <= beforeEndTime);
              }
              
              // 只保留在日期范围内的邮件
              if (emailTime < sinceTime || emailTime > beforeEndTime) {
                continue; // 跳过不在日期范围内的邮件
              }
            }
            
            const result: EmailSearchResult = {
              uid: String(email.messageId || Date.now()),
              messageId: email.messageId || '',
              subject: email.subject || '',
              from: email.from?.text || '',
              to: toText,
              date: emailDate,
              bodyText: email.text || '',
              bodyHtml: email.html || undefined,
              postcardId: recipient?.postcardId,
              recipientName: recipient?.recipientName,
              recipientCountry: recipient?.recipientCountry,
              recipientCity: recipient?.recipientCity,
              recipientAddress: recipient?.recipientAddress,
              recipientAge: recipient?.recipientAge,
              recipientGender: recipient?.recipientGender,
              recipientInterests: recipient?.recipientInterests,
            };
            
            results.push(result);
            
            // 进度回调：更新解析进度
            progressCallback?.({
              stage: 'parsing',
              message: `正在解析邮件内容...`,
              current: i + 1,
              total: emails.length,
            });
          }
          
          imap.end();
          
          // 进度回调：完成
          progressCallback?.({
            stage: 'completed',
            message: `成功获取 ${results.length} 封邮件`,
            current: results.length,
            total: results.length,
          });
          
          resolve(results);
        } catch (error) {
          imap.end();
          reject(error);
        }
      });

      imap.once('error', (err) => {
        clearTimeout(timeout);
        
        // 增强错误信息
        let errorMessage = err.message;
        
        if (err.message.includes('Invalid credentials') || 
            err.message.includes('login failed')) {
          errorMessage = '邮箱认证失败，请检查邮箱地址和密码（或授权码）';
        } else if (err.message.includes('ENOTFOUND')) {
          errorMessage = `无法找到邮箱服务器 ${config.imapHost}，请检查 IMAP 配置`;
        } else if (err.message.includes('ECONNREFUSED')) {
          errorMessage = `连接被拒绝，请检查端口 ${config.imapPort} 是否正确`;
        } else if (err.message.includes('ETIMEDOUT')) {
          errorMessage = '网络连接超时，请检查网络连接';
        }
        
        reject(new Error(errorMessage));
      });

      imap.connect();
    });
  }

  /**
   * 通用邮件搜索（支持任意邮箱）
   */
  async searchEmails(
    configId: string,
    options?: EmailSearchOptions
  ): Promise<EmailSearchResult[]> {
    const emailConfig = await this.getConfig(configId);

    if (!emailConfig) {
      throw new Error('邮箱配置不存在');
    }

    const config: EmailConfig = {
      imapHost: emailConfig.imapHost,
      imapPort: emailConfig.imapPort,
      imapUsername: emailConfig.imapUsername,
      imapPassword: emailConfig.imapPassword,
      useTLS: emailConfig.useTLS ?? true,
      rejectUnauthorized: emailConfig.rejectUnauthorized ?? true,
    };

    const progressCallback = options?.onProgress;

    return new Promise((resolve, reject) => {
      const imap = createImapConnection(config);
      const results: EmailSearchResult[] = [];

      // 进度回调：正在连接
      progressCallback?.({
        stage: 'connecting',
        message: '正在连接邮箱服务器...',
      });

      const timeout = setTimeout(() => {
        imap.destroy();
        reject(new Error('搜索超时'));
      }, 60000);

      imap.once('ready', async () => {
        try {
          // 进度回调：正在搜索
          progressCallback?.({
            stage: 'searching',
            message: '正在搜索邮件...',
          });
          
          // 打开邮箱文件夹
          const folder = options?.folder || 'INBOX';
          try {
            await openBox(imap, folder);
          } catch (err: any) {
            imap.end();
            reject(new Error(`文件夹 "${folder}" 不存在或无法访问: ${err.message}`));
            return;
          }

          // 构建搜索条件
          const criteria: any[] = [];
          
          // 未读邮件
          if (options?.unreadOnly) {
            criteria.push('UNSEEN');
          }
          
          // 时间范围（开始日期）
          if (options?.since) {
            criteria.push(['SINCE', options.since]);
          }
          
          // 时间范围（结束日期）
          if (options?.before) {
            criteria.push(['BEFORE', options.before]);
          }
          
          // 指定主题
          if (options?.searchQuery) {
            criteria.push(['SUBJECT', options.searchQuery]);
          }

          // 如果没有指定任何条件，搜索所有邮件
          if (criteria.length === 0) {
            criteria.push('ALL');
          }

          // 搜索邮件
          const uids = await searchEmails(imap, criteria);
          
          // 限制数量
          const limit = options?.limit || 20;
          const limitedUids = uids.slice(-limit);
          
          if (limitedUids.length === 0) {
            imap.end();
            progressCallback?.({
              stage: 'completed',
              message: '未找到符合条件的邮件',
              current: 0,
              total: 0,
            });
            resolve([]);
            return;
          }

          // 进度回调：正在获取邮件
          progressCallback?.({
            stage: 'fetching',
            message: `找到 ${limitedUids.length} 封邮件，正在获取...`,
            current: 0,
            total: limitedUids.length,
          });

          // 获取邮件详情
          const fetch = imap.fetch(limitedUids, {
            bodies: '',
            struct: true,
          });

          let processedCount = 0;
          
          // 等待所有邮件处理完成后再 resolve
          // 使用 Promise.all 等待所有邮件的 stream 处理完成
          const processPromises: Promise<void>[] = [];
          
          fetch.on('message', (msg: any) => {
            const emailData: any = {};
            const processPromise = new Promise<void>((resolveMsg) => {
              msg.on('attributes', (attrs: any) => {
                emailData.uid = attrs.uid;
              });

              msg.on('body', (stream: any) => {
                let buffer = '';
                stream.on('data', (chunk: any) => {
                  buffer += chunk.toString('utf8');
                });

                stream.once('end', async () => {
                  try {
                    const parsed = await simpleParser(buffer);
                    
                    // 处理 to 字段（可能是数组或对象）
                    let toText = '';
                    if (parsed.to) {
                      if (typeof parsed.to === 'string') {
                        toText = parsed.to;
                      } else if (Array.isArray(parsed.to)) {
                        toText = parsed.to.map(t => typeof t === 'string' ? t : (t as any).text || '').join(', ');
                      } else {
                        toText = (parsed.to as any).text || '';
                      }
                    }

                    const result: EmailSearchResult = {
                      uid: String(emailData.uid),
                      messageId: parsed.messageId || '',
                      subject: parsed.subject || '',
                      from: parsed.from?.text || '',
                      to: toText,
                      date: parsed.date || new Date(),
                      bodyText: parsed.text || '',
                      bodyHtml: parsed.html || undefined,
                    };

                    results.push(result);
                    processedCount++;

                    progressCallback?.({
                      stage: 'fetching',
                      message: `正在获取邮件... (${processedCount}/${limitedUids.length})`,
                      current: processedCount,
                      total: limitedUids.length,
                    });
                    
                    resolveMsg();
                  } catch (err) {
                    // console.error('解析邮件失败:', err);
                    resolveMsg();
                  }
                });
              });
            });
            processPromises.push(processPromise);
          });

          fetch.once('end', async () => {
            // 等待所有邮件处理完成
            await Promise.all(processPromises);
            
            clearTimeout(timeout);
            imap.end();
            
            progressCallback?.({
              stage: 'completed',
              message: `搜索完成，共获取 ${results.length} 封邮件`,
              current: results.length,
              total: results.length,
            });
            
            resolve(results);
          });

          fetch.once('error', (err: any) => {
            clearTimeout(timeout);
            imap.end();
            reject(err);
          });
        } catch (error: any) {
          clearTimeout(timeout);
          imap.end();
          reject(new Error(`搜索失败: ${error.message}`));
        }
      });

      imap.once('error', (err: any) => {
        clearTimeout(timeout);
        reject(new Error(`连接失败: ${err.message}`));
      });

      imap.connect();
    });
  }

  /**
   * 获取邮件详情
   */
  async getEmailDetail(configId: string, uid: string): Promise<EmailSearchResult | null> {
    const emailConfig = await this.getConfig(configId);

    if (!emailConfig) {
      throw new Error('邮箱配置不存在');
    }

    // 尝试从数据库获取
    const storedEmail = await prisma.email.findFirst({
      where: { uid },
    });

    if (storedEmail) {
      return {
        uid: storedEmail.uid,
        messageId: storedEmail.messageId,
        subject: storedEmail.subject,
        from: storedEmail.from,
        to: storedEmail.to,
        date: storedEmail.receivedAt,
        bodyText: storedEmail.bodyText,
        bodyHtml: storedEmail.bodyHtml || undefined,
        postcardId: storedEmail.postcardId || undefined,
        recipientName: storedEmail.recipientName || undefined,
        recipientCountry: storedEmail.recipientCountry || undefined,
        recipientCity: storedEmail.recipientCity || undefined,
        recipientAddress: storedEmail.recipientAddress || undefined,
        recipientAge: storedEmail.recipientAge || undefined,
        recipientGender: storedEmail.recipientGender || undefined,
        recipientInterests: storedEmail.recipientInterests || undefined,
      };
    }

    return null;
  }

  /**
   * 获取邮件正文
   */
  async getEmailBody(configId: string, emailId: string): Promise<string> {
    const config = await this.getConfig(configId);

    if (!config) {
      throw new Error('邮箱配置不存在');
    }

    // 从数据库获取
    const email = await prisma.email.findUnique({
      where: { id: emailId },
    });

    if (email) {
      return email.bodyText;
    }

    return '';
  }

  /**
   * 保存邮件到数据库（使用脱敏处理）
   */
  async saveEmailToDatabase(
    userId: string,
    configId: string,
    email: EmailSearchResult
  ): Promise<string> {
    const savedEmail = await prisma.email.create({
      data: {
        userId,
        messageId: email.messageId,
        // 脱敏：主题中可能包含邮箱
        subject: sanitizeEmailSubject(email.subject),
        // 脱敏：发件人/收件人字段
        from: sanitizeEmailAddressField(email.from),
        to: sanitizeEmailAddressField(email.to),
        // 脱敏：正文内容，移除敏感信息
        content: sanitizeEmailContent(email.bodyText || '').substring(0, 500),
        // 不再存储原始 HTML（可能包含完整邮件内容和追踪像素等）
        htmlContent: null,
        receivedAt: email.date,
        // 使用 metadata 存储额外信息
        metadata: JSON.stringify({
          emailConfigId: configId,
          uid: email.uid,
          postcardId: email.postcardId,
        }),
      },
    });

    return savedEmail.id;
  }

  /**
   * 批量保存邮件到数据库
   */
  async saveEmailsToDatabase(
    userId: string,
    configId: string,
    emails: EmailSearchResult[]
  ): Promise<number> {
    let savedCount = 0;

    for (const email of emails) {
      try {
        // 检查是否已存在
        const existing = await prisma.email.findFirst({
          where: {
            userId,
            emailConfigId: configId,
            uid: email.uid,
          },
        });

        if (!existing) {
          await this.saveEmailToDatabase(userId, configId, email);
          savedCount++;
        }
      } catch (error) {
        // console.error(`保存邮件 ${email.uid} 失败:`, error);
      }
    }

    return savedCount;
  }

  /**
   * 列出邮箱文件夹
   */
  async listFolders(configId: string): Promise<string[]> {
    const emailConfig = await this.getConfig(configId);

    if (!emailConfig) {
      throw new Error('邮箱配置不存在');
    }

    const config: EmailConfig = {
      imapHost: emailConfig.imapHost,
      imapPort: emailConfig.imapPort,
      imapUsername: emailConfig.imapUsername,
      imapPassword: emailConfig.imapPassword,
      useTLS: emailConfig.useTLS ?? true,
      rejectUnauthorized: emailConfig.rejectUnauthorized ?? true,
    };

    return new Promise((resolve, reject) => {
      const imap = createImapConnection(config);
      const folders: string[] = [];

      const timeout = setTimeout(() => {
        imap.end();
        reject(new Error('获取文件夹列表超时'));
      }, 30000);

      imap.once('ready', () => {
        clearTimeout(timeout);
        
        imap.getBoxes((err, boxes) => {
          if (err) {
            imap.end();
            reject(err);
            return;
          }

          const extractFolders = (boxObj: any, prefix = '') => {
            for (const name in boxObj) {
              const fullPath = prefix ? `${prefix}${name}` : name;
              folders.push(fullPath);
              
              if (boxObj[name].children) {
                extractFolders(boxObj[name].children, `${fullPath}/`);
              }
            }
          };

          extractFolders(boxes);
          imap.end();
          resolve(folders);
        });
      });

      imap.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      imap.connect();
    });
  }
}

// 导出服务实例
export const emailService = new EmailService();
