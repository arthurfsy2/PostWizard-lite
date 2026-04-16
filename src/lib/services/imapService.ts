/**
 * 基于 node-imap 的 IMAP 邮件服务
 * 支持手动控制认证方式（LOGIN vs PLAIN）
 */

import Imap from 'imap';
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

/**
 * 创建 IMAP 客户端（使用 LOGIN 认证）
 */
function createImapClient(config: EmailConfig): Imap {
  const imap = new Imap({
    user: config.imapUsername,
    password: config.imapPassword,
    host: config.imapHost,
    port: config.imapPort,
    tls: config.useTLS,
    tlsOptions: {
      rejectUnauthorized: false,
    },
    // 不指定 authScheme，让 node-imap 自动协商（参考 QQ 邮箱 skill）
    debug: (msg: string) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[imap]', msg);
      }
    },
  });

  return imap;
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
  const imap = createImapClient(config);

  return new Promise((resolve, reject) => {
    imap.once('ready', () => {
      imap.openBox(options.folder, false, (err, box) => {
        if (err) {
          imap.end();
          reject(err);
          return;
        }

        // 搜索所有邮件（使用 UID 搜索）
        imap.search(['ALL'], (err, results) => {
          if (err) {
            imap.end();
            reject(err);
            return;
          }

          if (results.length === 0) {
            imap.end();
            resolve([]);
            return;
          }

          // 使用 UID FETCH 获取邮件 headers
          const f = imap.fetch(results, { bodies: 'HEADER.FIELDS (SUBJECT)', markSeen: false });
          const filteredUids: number[] = [];

          f.on('message', (msg) => {
            let uid: number | undefined;
            let buffer = '';
            
            // 从 attributes 事件获取 UID
            msg.once('attributes', (attrs) => {
              uid = attrs.uid;
            });
            
            msg.on('body', (stream) => {
              stream.on('data', (chunk: Buffer) => {
                buffer += chunk.toString('utf8');
              });
            });

            msg.once('end', () => {
              const subjectMatch = buffer.match(/SUBJECT[^\r\n]*$/im);
              const subject = subjectMatch ? subjectMatch[0].replace('SUBJECT ', '').trim() : '';
              
              if (subject.includes(options.searchQuery) && uid !== undefined) {
                filteredUids.push(uid);
              }
            });
          });

          f.once('end', () => {
            console.log(`[imap] 搜索到 ${filteredUids.length} 封邮件`);
            imap.end();
            resolve(filteredUids);
          });
        });
      });
    });

    imap.once('error', reject);
    imap.connect();
  });
}

/**
 * 获取邮件 headers
 */
export async function fetchEmailHeaders(
  configId: string,
  uids: number[],
  folder: string
): Promise<Array<{ uid: number; subject: string; date: Date; from: string }>> {
  const config = await getEmailConfig(configId);
  const imap = createImapClient(config);

  return new Promise((resolve, reject) => {
    imap.once('ready', () => {
      imap.openBox(folder, false, (err) => {
        if (err) {
          imap.end();
          reject(err);
          return;
        }

        const headers: Array<{ uid: number; subject: string; date: Date; from: string }> = [];
        const f = imap.fetch(uids, { 
          bodies: 'HEADER.FIELDS (SUBJECT DATE FROM)',
          markSeen: false 
        });

        f.on('message', (msg) => {
          let uid: number | undefined;
          let buffer = '';

          // 从 attributes 事件获取 UID
          msg.once('attributes', (attrs) => {
            uid = attrs.uid;
          });

          msg.on('body', (stream) => {
            stream.on('data', (chunk: Buffer) => {
              buffer += chunk.toString('utf8');
            });
          });

          msg.once('end', () => {
            const subjectMatch = buffer.match(/SUBJECT[^\r\n]*$/im);
            const dateMatch = buffer.match(/DATE[^\r\n]*$/im);
            const fromMatch = buffer.match(/FROM[^\r\n]*$/im);

            headers.push({
              uid: uid || 0,
              subject: subjectMatch ? subjectMatch[0].replace('SUBJECT ', '').trim() : '',
              date: dateMatch ? new Date(dateMatch[0].replace('DATE ', '').trim()) : new Date(),
              from: fromMatch ? fromMatch[0].replace('FROM ', '').trim() : '',
            });
          });
        });

        f.once('end', () => {
          console.log(`[imap] 获取 ${headers.length} 封邮件的 headers`);
          imap.end();
          resolve(headers);
        });
      });
    });

    imap.once('error', reject);
    imap.connect();
  });
}

/**
 * 获取邮件完整内容（带预过滤）
 */
export async function fetchEmailFullContent(
  configId: string,
  allUids: number[],
  folder: string,
  existingPostcardIds: Set<string>,
  onProgress?: (current: number, total: number, batch: number, totalBatches: number) => void
): Promise<{ emails: ParsedMail[]; failedUids: number[] }> {
  const config = await getEmailConfig(configId);
  const imap = createImapClient(config);

  const emails: ParsedMail[] = [];
  const failedUids: number[] = [];

  return new Promise((resolve, reject) => {
    imap.once('ready', () => {
      imap.openBox(folder, false, (err) => {
        if (err) {
          imap.end();
          reject(err);
          return;
        }

        console.log(`[imap] 开始获取 ${allUids.length} 封邮件，已存在 ${existingPostcardIds.size} 封`);

        // 先获取 headers 进行预过滤
        fetchEmailHeaders(configId, allUids, folder).then((headersList) => {
          // 过滤已存在的 postcardId
          // 匹配格式：2 位大写字母 + - + 1 位或多位数字（不同国家位数不同）
          const newUids = headersList.filter(h => {
            const postcardId = h.subject.match(/([A-Z]{2}-\d+)/)?.[1];
            return postcardId && !existingPostcardIds.has(postcardId);
          }).map(h => h.uid);

          console.log(`[imap] 过滤后需要下载 ${newUids.length} 封新邮件`);

          if (newUids.length === 0) {
            imap.end();
            resolve({ emails: [], failedUids: [] });
            return;
          }

          // 分批下载（每批 20 封）
          const batchSize = 20;
          const totalBatches = Math.ceil(newUids.length / batchSize);
          let currentBatch = 0;

          const processBatch = () => {
            if (currentBatch >= totalBatches) {
              console.log(`[imap] 完成：成功 ${emails.length} 封，失败 ${failedUids.length} 封`);
              imap.end();
              resolve({ emails, failedUids });
              return;
            }

            const batchUids = newUids.slice(currentBatch * batchSize, (currentBatch + 1) * batchSize);
            let batchProcessedCount = 0; // 每批独立计数
            
            console.log(`[imap] 批次 ${currentBatch + 1}/${totalBatches} (${batchUids.length} 封)`);

            const f = imap.fetch(batchUids, { bodies: '', markSeen: false });

            f.on('message', (msg) => {
              let uid: number | undefined;
              let buffer = '';

              // 从 attributes 事件获取 UID
              msg.once('attributes', (attrs) => {
                uid = attrs.uid;
              });

              msg.on('body', (stream) => {
                stream.on('data', (chunk: Buffer) => {
                  buffer += chunk.toString('utf8');
                });
              });

              msg.once('end', async () => {
                try {
                  const parsed = await simpleParser(buffer);
                  (parsed as any).uid = uid;
                  emails.push(parsed);
                  console.log(`[imap] ✅ UID ${uid} 解析成功`);
                } catch (e: any) {
                  console.error(`[imap] ❌ UID ${uid} 解析失败:`, e.message);
                  if (uid) failedUids.push(uid);
                }

                batchProcessedCount++;
                if (batchProcessedCount >= batchUids.length) {
                  // 本批次完成，发送进度
                  onProgress?.(emails.length, newUids.length, currentBatch + 1, totalBatches);
                  
                  currentBatch++;
                  // 批次间等待 1 秒
                  setTimeout(processBatch, 1000);
                }
              });
            });

            f.once('error', (err) => {
              console.error(`[imap] 批次 ${currentBatch + 1} 错误:`, err);
              failedUids.push(...batchUids);
              currentBatch++;
              setTimeout(processBatch, 1000);
            });
          };

          processBatch();
        }).catch(reject);
      });
    });

    imap.once('error', reject);
    imap.connect();
  });
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

  const password = decryptSafe((config as any).imapPass);
  console.log('[imap] 用户名:', (config as any).imapUser);
  console.log('[imap] 密码长度:', password.length);

  return {
    imapHost: config.imapHost,
    imapPort: config.imapPort,
    imapUsername: (config as any).imapUser, // 注意：schema 中是 imapUser 不是 imapUsername
    imapPassword: password,
    useTLS: true,
  };
}
