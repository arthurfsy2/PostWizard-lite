/**
 * 基于 imapflow 的 IMAP 邮件服务
 * 参考 Python imap_tools 的简洁实现
 */

import { ImapFlow } from 'imapflow';
import { simpleParser, ParsedMail } from 'mailparser';
import { prisma } from '../prisma';
import { decryptSafe } from '../crypto';

interface EmailConfig {
  imapHost: string;
  imapPort: number;
  imapUsername: string;
  imapPassword: string;
  useTLS: boolean;
}

interface FetchResult {
  success: boolean;
  count: number;
  failedUids?: number[];
  error?: string;
}

/**
 * 创建 IMAP 客户端
 */
async function createImapClient(config: EmailConfig): Promise<ImapFlow> {
  const client = new ImapFlow({
    host: config.imapHost,
    port: config.imapPort,
    auth: {
      user: config.imapUsername,
      pass: config.imapPassword,
    },
    tls: config.useTLS,
    tlsOptions: {
      rejectUnauthorized: false,
    },
    // 禁用自动认证，我们手动处理
    disableCompression: true,
    log: {
      // 只在开发环境启用详细日志
      level: process.env.NODE_ENV === 'development' ? 'trace' : 'warn',
    },
  });

  await client.connect();
  
  // 手动使用 LOGIN 认证（QQ 邮箱支持）
  try {
    await client.login(config.imapUsername, config.imapPassword);
  } catch (error: any) {
    console.error('[imapflow] LOGIN 失败:', error.message);
    throw error;
  }
  
  return client;
}

/**
 * 搜索邮件 UID 列表
 */
export async function searchEmailUids(
  configId: string,
  options: {
    folder: string;
    searchQuery: string;
  }
): Promise<number[]> {
  const config = await getEmailConfig(configId);
  const client = await createImapClient(config);

  try {
    // 打开指定文件夹
    await client.mailboxOpen(options.folder);

    // 搜索所有未读邮件（或所有邮件）
    const messages = await client.search({ unseen: false });

    // 过滤包含搜索关键词的邮件
    const filteredUids: number[] = [];
    for await (const message of client.fetch(messages, { envelope: true })) {
      const subject = message.envelope.subject || '';
      if (subject.includes(options.searchQuery)) {
        filteredUids.push(message.uid);
      }
    }

    console.log(`[imapflow] 搜索到 ${filteredUids.length} 封邮件`);
    return filteredUids;
  } finally {
    await client.logout();
  }
}

/**
 * 获取邮件 headers（用于预过滤）
 */
export async function fetchEmailHeaders(
  configId: string,
  uids: number[],
  folder: string
): Promise<Array<{ uid: number; subject: string; date: Date; from: string }>> {
  const config = await getEmailConfig(configId);
  const client = await createImapClient(config);

  try {
    await client.mailboxOpen(folder);

    const headers: Array<{ uid: number; subject: string; date: Date; from: string }> = [];

    // 批量获取 headers
    for await (const message of client.fetch(uids, { envelope: true, uid: true })) {
      headers.push({
        uid: message.uid,
        subject: message.envelope.subject || '',
        date: message.envelope.date || new Date(),
        from: message.envelope.from?.[0]?.address || '',
      });
    }

    console.log(`[imapflow] 获取 ${headers.length} 封邮件的 headers`);
    return headers;
  } finally {
    await client.logout();
  }
}

/**
 * 获取邮件完整内容（带预过滤）
 */
export async function fetchEmailFullContent(
  configId: string,
  allUids: number[],
  folder: string,
  existingPostcardIds: Set<string>
): Promise<{ emails: ParsedMail[]; failedUids: number[] }> {
  const config = await getEmailConfig(configId);
  const client = await createImapClient(config);

  const emails: ParsedMail[] = [];
  const failedUids: number[] = [];

  try {
    await client.mailboxOpen(folder);

    console.log(`[imapflow] 开始获取 ${allUids.length} 封邮件，已存在 ${existingPostcardIds.size} 封`);

    // 先获取 headers 进行预过滤
    const headersList = await fetchEmailHeaders(configId, allUids, folder);

    // 过滤已存在的 postcardId
    // 匹配格式：2 位大写字母 + - + 1 位或多位数字（不同国家位数不同）
    const newUids = headersList.filter(h => {
      const postcardId = h.subject.match(/([A-Z]{2}-\d+)/)?.[1];
      return postcardId && !existingPostcardIds.has(postcardId);
    }).map(h => h.uid);

    console.log(`[imapflow] 过滤后需要下载 ${newUids.length} 封新邮件`);

    if (newUids.length === 0) {
      return { emails: [], failedUids: [] };
    }

    // 分批下载完整内容（每批 20 封）
    const batchSize = 20;
    for (let i = 0; i < newUids.length; i += batchSize) {
      const batchUids = newUids.slice(i, i + batchSize);
      console.log(`[imapflow] 批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(newUids.length / batchSize)}`);

      try {
        for await (const message of client.fetch(batchUids, { source: true, uid: true })) {
          try {
            const parsed = await simpleParser(message.source);
            (parsed as any).uid = message.uid;
            emails.push(parsed);
            console.log(`[imapflow] ✅ UID ${message.uid} 解析成功`);
          } catch (e: any) {
            console.error(`[imapflow] ❌ UID ${message.uid} 解析失败:`, e.message);
            failedUids.push(message.uid);
          }
        }
      } catch (e: any) {
        console.error(`[imapflow] 批次 ${Math.floor(i / batchSize) + 1} 失败:`, e.message);
        failedUids.push(...batchUids);
      }

      // 批次间等待 1 秒，避免 IMAP 服务器限流
      if (i + batchSize < newUids.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`[imapflow] 完成：成功 ${emails.length} 封，失败 ${failedUids.length} 封`);
    return { emails, failedUids };
  } finally {
    await client.logout();
  }
}

/**
 * 获取邮箱配置
 */
async function getEmailConfig(configId: string): Promise<EmailConfig> {
  const config = await prisma.emailConfig.findUnique({
    where: { id: configId },
  });

  if (!config) {
    throw new Error('邮箱配置不存在');
  }

  return {
    imapHost: config.imapHost,
    imapPort: config.imapPort,
    imapUsername: config.imapUsername,
    imapPassword: decryptSafe((config as any).imapPass),
    useTLS: true,
  };
}
