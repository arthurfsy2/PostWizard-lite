import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLocalUserId } from '@/lib/local-user';
import { fetchEmailFullContent, searchEmailUids } from '@/lib/services/imapService';
import { getCountryCode, getCountryName } from '@/lib/country-codes';
import { analyzeMessagesBatchOptimized } from '@/lib/services/sentimentAnalysis';
import { getConfigForPurpose } from '@/lib/services/ai-config';
import { invalidateHighlightsCache } from '@/lib/services/cache';
import { Semaphore } from '@/lib/utils/semaphore';
import { sanitizeEmail, sanitizeEmailSubject, generateEmailSummary } from '@/lib/helpers/emailSanitizer';

const MIN_MESSAGE_LENGTH = 5;


/**
 * POST /api/arrivals/parse
 * 解析抵达确认邮件（支持 Server-Sent Events 实时进度）
 * 
 * Request body:
 * - configId: 邮箱配置 ID（必填）
 * - folder: 邮箱文件夹（可选，默认 INBOX）
 * - limit: 解析数量（可选，默认 20）
 * 
 * Response: Server-Sent Events 流
 * - progress: 进度更新
 * - success: 单封邮件解析成功
 * - error: 单封邮件解析失败
 * - complete: 全部完成
 */
export async function POST(request: NextRequest) {
  // 1. 验证用户登录状态
  const userId = getLocalUserId();
// AUTH_CHECK_REMOVED
  if (false) {
    return new Response(JSON.stringify({ error: '未登录' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. 解析请求参数
  const body = await request.json();
  const {
    configId,
    folder = 'INBOX',
    limit = 20,
    forceAll = false, // 强制获取所有邮件（速度慢但确保不遗漏）
    forceReparse = false, // 强制重新解析：删除已有记录后重新解析
  } = body;

  if (!configId) {
    return new Response(JSON.stringify({ error: '缺少邮箱配置 ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 3. 验证邮箱配置
  const emailConfig = await prisma.emailConfig.findFirst({
    where: {
      id: configId,
      userId: userId,
    },
  });

  if (!emailConfig) {
    return new Response(JSON.stringify({ error: '邮箱配置不存在' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 4. 创建 SSE 流
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // AI 分析并发控制：限制同时最多 5 个请求在飞
      // DashScope qwen-vl-plus 默认 RPM ≈ 60，合理留出余量
      const aiSemaphore = new Semaphore(5);

      try {
        // 5. 获取数据库中已保存的 postcardId（用于去重）
        sendEvent('status', { message: '正在查询已解析的邮件...', progress: 10 });
        
        const existingReplies = await prisma.arrivalReply.findMany({
          where: { userId: userId },
          select: { postcardId: true },
        });

        const existingAnalyses = await prisma.messageAnalysis.findMany({
          where: { userId: userId },
          select: { postcardId: true },
        });
        
        let existingPostcardIds = new Set(existingReplies.map(r => r.postcardId).filter(Boolean));
        const existingAnalysisPostcardIds = new Set(existingAnalyses.map(r => r.postcardId).filter(Boolean));
        
        // forceReparse: 删除已有 arrivalReply 后重新解析，但保留旧的精选分析结果
        if (forceReparse && existingPostcardIds.size > 0) {
          sendEvent('status', { message: '⚠️ 强制重新解析模式：正在刷新邮件解析结果（保留精选分析）...', progress: 15 });
          
          // 获取当前邮箱配置对应的 postcardId 列表（通过邮件内容匹配）
          // 先搜索所有邮件，获取 postcardId 列表
          const previewSearchQuery = 'Hurray! Your postcard';
          const previewUids = await searchEmailUids(configId, { folder, searchQuery: previewSearchQuery });
          const { emails: previewEmails } = await fetchEmailFullContent(
            configId, 
            previewUids.slice(0, 50), // 限制预览数量
            folder, 
            new Set(), // 不做预过滤
            () => {}
          );
          
          // 从邮件中提取 postcardId
          const postcardIdsToDelete: string[] = [];
          for (const email of previewEmails) {
            const match = email.subject?.match(/([A-Z]{2}-\d+)/);
            if (match && existingPostcardIds.has(match[1])) {
              postcardIdsToDelete.push(match[1]);
            }
          }
          
          if (postcardIdsToDelete.length > 0) {
            // 删除这些 arrivalReply 记录，后续按最新邮件重新入库
            const deleteResult = await prisma.arrivalReply.deleteMany({
              where: {
                userId: userId,
                postcardId: { in: postcardIdsToDelete },
              },
            });
            
            sendEvent('status', { 
              message: `✅ 已刷新 ${deleteResult.count} 条旧解析结果，后续仅补齐缺失精选分析...`, 
              progress: 18 
            });
            
            // 更新 existingPostcardIds，移除已删除的
            for (const id of postcardIdsToDelete) {
              existingPostcardIds.delete(id);
            }
          } else {
            sendEvent('status', { 
              message: 'ℹ️ 未找到需要重新解析的记录', 
              progress: 18 
            });
          }
        }
        
        sendEvent('status', { 
          message: `已解析 ${existingPostcardIds.size} 封，开始获取新邮件...`, 
          progress: 20 
        });
        
        // 6. 使用 imapflow 获取并过滤邮件（自动预过滤）
        sendEvent('status', {
          message: `正在搜索并下载新邮件...`,
          progress: 25
        });
        
        const searchQuery = 'Hurray! Your postcard';
        const allUids = await searchEmailUids(configId, { folder, searchQuery });
        
        // 使用新的 imapflow 服务，带预过滤和进度回调
        const totalBatches = Math.ceil(allUids.length / 20);
        let completedBatches = 0;
        
        const { emails, failedUids } = await fetchEmailFullContent(
          configId, 
          allUids, 
          folder, 
          existingPostcardIds,
          (current, total, batch, totalBatches) => {
            // 每批完成后发送进度到前端
            completedBatches = batch;
            const progress = 30 + Math.round((completedBatches / totalBatches) * 65); // 30-95%
            sendEvent('progress', {
              progress,
              message: `已完成第 ${batch}/${totalBatches} 批，解析 ${current} 封`,
              current,
              total,
              batch,
              totalBatches
            });
          }
        );

        // 调试日志：检查下载结果
        console.log(`[Parse] 下载完成：emails=${emails.length}, failedUids=${failedUids.length}, total=${allUids.length}`);

        // 如果有失败的 UID，记录并提示用户重试
        if (failedUids.length > 0) {
          sendEvent('warning', {
            message: `⚠️ 有 ${failedUids.length} 封邮件下载失败，请稍后重试`,
            failedUids,
            hint: '系统已记录失败的邮件 UID，下次解析时会自动重试'
          });
        }
        
        // 如果下载的邮件数量少于 UID 数量，说明有失败但没有记录
        if (emails.length < allUids.length && failedUids.length === 0) {
          const missingCount = allUids.length - emails.length;
          console.error(`[Parse] ⚠️ 异常：请求 ${allUids.length} 封，实际下载 ${emails.length} 封，缺少 ${missingCount} 封，但没有 failedUids 记录`);
        }
        
        // 边过滤边保存，每封邮件解析后立即入库
        let successCount = 0;
        let failedCount = 0;
        let skippedCount = 0;
        let queuedAnalysisCount = 0;
        const pendingAnalysis: Array<{
          postcardId: string;
          message: string;
          recipientName?: string;
          country?: string;
          arrivedAt?: Date;
        }> = [];
        
        sendEvent('status', {
          message: `开始解析 ${emails.length} 封邮件...`,
          progress: 35
        });
        
        for (let i = 0; i < emails.length; i++) {
          const email = emails[i];
          
          // 优先检查 postcardId（更可靠）
          // 匹配格式：2 位大写字母 + - + 1 位或多位数字（不同国家位数不同）
          const postcardIdMatch = email.subject?.match(/([A-Z]{2}-\d+)/);
          
          if (!postcardIdMatch) {
            skippedCount++;
            sendEvent('skip', { 
              postcardId: 'N/A',
              subject: email.subject,
              reason: '无法提取 Postcard ID',
              index: i + 1,
              total: emails.length
            });
            continue;
          }
          
          const postcardId = postcardIdMatch[1];
          
          // 检查是否已存在
          if (existingPostcardIds.has(postcardId)) {
            skippedCount++;
            sendEvent('skip', { 
              postcardId,
              subject: email.subject,
              reason: 'postcardId 已存在',
              index: i + 1,
              total: emails.length
            });
            continue;
          }
          
          // 解析并保存邮件（立即入库）
          try {
            const parsedInfo = parseArrivalEmail({
              subject: email.subject,
              content: email.text || email.html || '',
              htmlContent: email.html || email.text || '',
              receivedAt: email.date,
            });
            
            // 保存到数据库（使用脱敏处理，不存储原始邮件完整内容和敏感信息）
            await prisma.arrivalReply.create({
              data: {
                userId: userId,
                postcardId,
                destinationCountry: parsedInfo.country,
                destinationCity: parsedInfo.city,
                recipientName: parsedInfo.recipientName,
                // 脱敏：不存储对方完整邮箱，只存储脱敏版本
                recipientEmail: parsedInfo.recipientEmail ? sanitizeEmail(parsedInfo.recipientEmail) : null,
                travelDays: parsedInfo.travelDays,
                distance: parsedInfo.distance,
                message: parsedInfo.message,
                // 不再存储 messageOriginal（原始留言）
                arrivedAt: parsedInfo.arrivedAt || (email.date instanceof Date ? email.date : new Date()),
                // 脱敏：主题中可能包含邮箱
                rawSubject: sanitizeEmailSubject(email.subject),
                // 脱敏：只存储摘要，不存储完整邮件原文
                rawContent: generateEmailSummary(email.text || email.html || '', 300),
              },
            });
            
            successCount++;
            sendEvent('success', {
              postcardId,
              country: parsedInfo.country,
              city: parsedInfo.city,
              index: i + 1,
              total: emails.length
            });

            // 🚀 并行触发 AI 情感分析（不阻塞解析流程，但限制并发数）
            // 强制重解析时保留旧分析，仅对缺失分析的留言补齐
            const normalizedMessage = parsedInfo.message?.trim();
            const shouldAnalyze = Boolean(
              normalizedMessage &&
              normalizedMessage.length >= MIN_MESSAGE_LENGTH &&
              !existingAnalysisPostcardIds.has(postcardId)
            );

            if (shouldAnalyze && normalizedMessage) {
              queuedAnalysisCount++;
              existingAnalysisPostcardIds.add(postcardId);
              pendingAnalysis.push({
                postcardId,
                message: normalizedMessage,
                recipientName: parsedInfo.recipientName,
                country: parsedInfo.country,
                arrivedAt: parsedInfo.arrivedAt,
              });
            }
            
            // 每 10 封发送一次进度
            if (successCount % 10 === 0 || successCount === emails.length) {
              const progress = 40 + Math.round((successCount / emails.length) * 55); // 40-95%
              sendEvent('progress', {
                progress,
                success: successCount,
                failed: failedCount,
                skipped: skippedCount,
                current: successCount + failedCount + skippedCount,
                total: emails.length,
                message: `已入库 ${successCount} 封，已补排队 ${queuedAnalysisCount} 条精选分析`
              });
            }
          } catch (error: any) {
            failedCount++;
            sendEvent('error', {
              postcardId,
              error: error.message,
              index: i + 1,
              total: emails.length
            });
          }
        }
        
        // 🚀 批次批量分析（所有邮件解析完成后）
        if (pendingAnalysis.length > 0) {
          sendEvent('status', {
            message: `开始批量分析 ${pendingAnalysis.length} 条留言...`,
            progress: 96
          });
          
          const modelVersion = (await getConfigForPurpose('text')).model;
          const cacheTTL = 24 * 60 * 60 * 1000;
          const cacheValidUntil = new Date(Date.now() + cacheTTL);
          
          // Fire-and-forget：不阻塞 SSE 响应
          void (async () => {
            try {
              console.log(`[批量分析] 开始分析 ${pendingAnalysis.length} 条留言...`);
              
              // 使用优化版批量分析（规则优先 + 批量 AI）
              const results = await analyzeMessagesBatchOptimized(
                pendingAnalysis.map(r => ({
                  id: r.postcardId,
                  message: r.message,
                })),
                20,  // 每批 20 条
                (current, total) => {
                  console.log(`[批量分析] 进度：${current}/${total}`);
                }
              );
              
              console.log(`[批量分析] 分析完成，共 ${results.length} 条结果，开始保存到数据库...`);
              
              // 批量保存到数据库
              for (const result of results) {
                const pending = pendingAnalysis.find(r => r.postcardId === result.id);
                if (!pending) continue;
                
                // 区分打分来源：规则引擎 vs AI
                const isRuleEngine = result.analysis._source === 'rule-engine';
                const savedModelVersion = isRuleEngine ? 'rule-engine-v1' : modelVersion;
                
                try {
                  await prisma.messageAnalysis.upsert({
                    where: { postcardId: result.id },
                    create: {
                      userId: userId,
                      postcardId: result.id,
                      message: pending.message,
                      sender: pending.recipientName,
                      country: pending.country,
                      arrivedAt: pending.arrivedAt,
                      aiScore: result.analysis.score,
                      categories: JSON.stringify(result.analysis.categories),
                      primaryCategory: result.analysis.primaryCategory,
                      emotion: result.analysis.emotion,
                      tags: JSON.stringify(result.analysis.tags),
                      translation: result.analysis.translation || null,
                      translationModel: result.analysis.translation ? savedModelVersion : null,
                      cacheValidUntil,
                      modelVersion: savedModelVersion,
                    },
                    update: {
                      message: pending.message,
                      sender: pending.recipientName,
                      country: pending.country,
                      arrivedAt: pending.arrivedAt,
                      aiScore: result.analysis.score,
                      categories: JSON.stringify(result.analysis.categories),
                      primaryCategory: result.analysis.primaryCategory,
                      emotion: result.analysis.emotion,
                      tags: JSON.stringify(result.analysis.tags),
                      translation: result.analysis.translation || null,
                      translationModel: result.analysis.translation ? savedModelVersion : null,
                      cacheValidUntil,
                      modelVersion: savedModelVersion,
                      analyzedAt: new Date(),
                    },
                  });
                } catch (err) {
                  console.error(`[批量分析] ${result.id} 保存失败:`, err);
                }
              }
              
              // 清除精选缓存
              await invalidateHighlightsCache(userId);
              console.log(`[批量分析] 完成：成功 ${results.length} 条`);
            } catch (error) {
              console.error('[批量分析] 错误:', error);
            }
          })();
        }
        
        // 发送最终统计
        sendEvent('status', {
          message: `解析完成：成功 ${successCount} 封，失败 ${failedCount} 封，跳过 ${skippedCount} 封，补齐 ${queuedAnalysisCount} 条精选分析`,
          progress: 95
        });
        
        // 直接返回，不再重复解析
        sendEvent('complete', { 
          success: successCount, 
          failed: failedCount, 
          skipped: skippedCount,
          total: emails.length,
          queuedAnalysis: queuedAnalysisCount,
          message: `完成！成功入库 ${successCount} 封，并补齐 ${queuedAnalysisCount} 条缺失精选分析`
        });

        
        controller.close();
        return;
      } catch (error: any) {
        console.error('[Arrival Parse] Error:', error);
        sendEvent('error', { message: error.message || '解析失败' });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}



/**
 * 解析抵达确认邮件
 */
function parseArrivalEmail(email: any): {
  country: string;
  city?: string;
  recipientName?: string;
  recipientEmail?: string;
  travelDays?: number;
  distance?: number;
  message?: string;
  arrivedAt?: Date;
} {
  const subject = email.subject || '';
  const content = email.content || '';
  const htmlContent = email.htmlContent || '';

  // 1. 提取目的地国家/城市
  // 格式: "Hurray! Your postcard CN-1234567 to GERMANY (Berlin) has arrived!"
  // 提取 "to XXX has arrived" 或 "to XXX arrived" 中的国家名
  const fullMatch = subject.match(/to\s+(.+?)\s+(?:has\s+)?arrived/i);
  let country = 'UNKNOWN';
  let city: string | undefined;
  
  if (fullMatch) {
    const countryPart = fullMatch[1];
    // 检查是否有城市（括号内的内容）
    const cityMatch = countryPart.match(/(.+?)\s+\(([^)]+)\)/);
    const rawCountry = cityMatch ? cityMatch[1].trim() : countryPart.trim();
    city = cityMatch?.[2];
    
    // 使用 Postcrossing 官方国家名称映射
    const code = getCountryCode(rawCountry);
    if (code) {
      country = getCountryName(code) || rawCountry.toUpperCase();
    } else {
      // 找不到映射，保留原始名称（清理多余词汇）
      country = rawCountry.replace(/\s+(has|have|arrived|delivered)$/i, '').trim().toUpperCase();
    }
  }

  // 2. 提取收件人信息
  // 优先级：留言签名 > 邮件主题中的用户名
  let recipientName: string | undefined;
  let recipientEmail: string | undefined;
  
  // 优先从留言签名中提取（"Larisa wrote you a message"或"林芝如 wrote you a message"）
  // 支持中文、英文、下划线的用户名
  const signatureMatch = content.match(/^([\u4e00-\u9fa5A-Za-z_]+)\s+wrote you a message:/im);
  if (signatureMatch && signatureMatch[1]) {
    recipientName = signatureMatch[1].trim();
  }
  
  // 如果没有签名，从主题中提取用户名（"to Larisa_Petrosyan in Russia"）
  if (!recipientName) {
    const recipientMatch = content.match(/Your postcard\s+\S+\s+to\s+([A-Za-z][\w\s]+?)\s+in\s+/i);
    if (recipientMatch && recipientMatch[1]) {
      let name = recipientMatch[1].trim();
      // 过滤掉 "Postcrossing" 等无效名称
      if (name.toLowerCase() !== 'postcrossing' && name.toLowerCase() !== 'postcrosser') {
        recipientName = name;
      }
    }
  }

  // 3. 提取旅途天数
  // 格式: "after 15 days of travel" 或 "in just 5 days"
  const daysMatch = content.match(/in\s+(\d+)\s+days?\s+(?:of\s+travel|after)|after\s+(\d+)\s+days?|in\s+just\s+(\d+)\s+days?/i);
  const travelDays = daysMatch ? (parseInt(daysMatch[1] || daysMatch[2] || daysMatch[3])) : undefined;

  // 4. 提取距离
  // 格式: "traveling 8,234 km"
  const distanceMatch = content.match(/traveling\s+([\d,]+)\s*km/i);
  const distance = distanceMatch ? parseInt(distanceMatch[1].replace(/,/g, '')) : undefined;

  // 5. 提取对方留言（优先使用引号，支持多种引号类型）
  let message: string | undefined;
  
  // 核心策略：从 "wrote you a message:" 提取到 "Do not reply to this email" 之间的内容
  // Postcrossing 邮件格式统一：
  //   {name} wrote you a message:\n\n"{回复内容}"\n\n\nDo not reply to this email!...
  // 弯引号 "" 为不同字符（\u201C \u201D），不能用 \2 回溯
  // 签名（Name）保留为正文一部分，不做清理（避免误删正文段落）
  const blockMatch = content.match(
    /wrote you a message:\s*\n([\s\S]*?)(?:\n{1,}Do not reply to this email[\s\S]*|$)/i
  );

  if (blockMatch?.[1]) {
    let block = blockMatch[1].trim();
    // 去掉首尾引号（支持弯引号 "" 和直引号 ""）
    if (/^[""\u201C\u201D]/.test(block)) block = block.slice(1);
    if (/[""\u201D\u201C]$/.test(block)) block = block.slice(0, -1);
    message = block.trim();
    console.log(`[parseArrivalEmail] 提取留言成功，长度：${message.length}`);
  } else {
    // 备用：从签名行提取（兼容非标准格式）
    const messageMatch1 = content.match(/([\u4e00-\u9fa5A-Za-z_]+)\s+wrote you a message:\s*\n?([\s\S]+?)(?=\n\n\n|Do not reply to this email|$)/i);
    const messageMatch2 = content.match(/message from your recipient:\s*\n?([\s\S]+?)(?=\n\n\n|Do not reply to this email|$)/i);
    message = messageMatch1?.[2]?.trim() || messageMatch2?.[1]?.trim();
    if (message) {
      if (/^[""\u201C\u201D]/.test(message)) message = message.slice(1);
      if (/[""\u201D\u201C]$/.test(message)) message = message.slice(0, -1);
      message = message.split(/\n\n+(?=Do not reply|This is an email|--\n)/i)[0].trim();
      console.log(`[parseArrivalEmail] 使用备用模式提取留言，长度：${message.length}`);
    }
  }

  // 6. 提取送达日期
  // 格式: "Your postcard arrived on March 15, 2024"
  let arrivedAt: Date | undefined;
  if (email.receivedAt) {
    arrivedAt = new Date(email.receivedAt);
  }

  return {
    country,
    city,
    recipientName,
    recipientEmail,
    travelDays,
    distance,
    message,
    arrivedAt,
  };
}
