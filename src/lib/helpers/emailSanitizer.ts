/**
 * 邮箱内容脱敏处理
 * 
 * 目标：在存储与第三方邮箱相关的任何内容时，确保不保留敏感个人信息
 * 包括：详细地址、邮箱地址、电话号码、URL、完整邮件原文等
 */

/**
 * 脱敏邮箱地址
 * - 完整邮箱 → 仅保留域名部分或完全移除
 */
export function sanitizeEmail(email: string): string {
  if (!email) return '';
  
  // 简单脱敏：替换 @ 前的部分为 ***
  // 例如：user@example.com → ***@example.com
  return email.replace(/^[^@]+/, '***');
}

/**
 * 脱敏邮件正文内容
 * - 移除邮箱地址
 * - 移除电话号码
 * - 移除URL
 * - 移除地址行（ street/road/avenue 等）
 * - 保留：国家、城市、姓名、留言内容等
 */
export function sanitizeEmailContent(content: string): string {
  if (!content) return '';
  
  let sanitized = content;
  
  // 1. 移除邮箱地址
  sanitized = sanitized.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email removed]');
  
  // 2. 移除电话号码（各种格式）
  sanitized = sanitized.replace(/\+?\d[\d\s().-]{6,}\d/g, '[phone removed]');
  
  // 3. 移除URL
  sanitized = sanitized.replace(/https?:\/\/\S+/gi, '[link removed]');
  sanitized = sanitized.replace(/www\.\S+/gi, '[link removed]');
  
  // 4. 移除地址行（包含街道、门牌号等）
  const lines = sanitized.split(/\r?\n/);
  const filteredLines = lines.filter(line => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    
    // 过滤掉明显的地址行
    if (/^\d+\s+(street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|drive|dr\.?|boulevard|blvd\.?)/i.test(trimmed)) return false;
    if (/^(street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|drive|dr\.?|boulevard|blvd\.?|building|room|apartment|apt\.?|floor|fl\.?|district|province|postal code|zip code|postcode)\b/i.test(trimmed)) return false;
    if (/address\s*:/i.test(trimmed)) return false;
    if (/[\u4e00-\u9fa5].*(地址|街道|路|号|室|楼|区)/.test(trimmed)) return false;
    if (/^\d{4,}\s+[A-Za-z\u4e00-\u9fa5-]+/.test(trimmed)) return false;
    
    return true;
  });
  
  sanitized = filteredLines.join('\n');
  
  // 5. 清理多余空白
  sanitized = sanitized.replace(/\s{2,}/g, ' ');
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n');
  
  return sanitized.trim();
}

/**
 * 脱敏邮件主题
 * - 保留主题的核心信息
 * - 移除可能包含的邮箱地址
 */
export function sanitizeEmailSubject(subject: string): string {
  if (!subject) return '';
  
  // 移除主题中可能出现的邮箱
  return subject.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]');
}

/**
 * 脱敏收件人名称和邮箱对象
 * 用于处理邮件中的 from/to 字段
 */
export function sanitizeEmailAddressField(field: string): string {
  if (!field) return '';
  
  // 处理 "Name <email@example.com>" 格式
  const emailMatch = field.match(/<([^>]+)>/);
  if (emailMatch) {
    const email = emailMatch[1];
    const sanitizedEmail = sanitizeEmail(email);
    return field.replace(emailMatch[0], `<${sanitizedEmail}>`);
  }
  
  // 如果整个字段就是邮箱
  if (/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(field.trim())) {
    return sanitizeEmail(field);
  }
  
  return field;
}

/**
 * 生成邮件内容的摘要（用于存储）
 * 不存储完整内容，只存储用于展示和处理的摘要
 */
export function generateEmailSummary(content: string, maxLength: number = 200): string {
  if (!content) return '';
  
  // 先脱敏
  const sanitized = sanitizeEmailContent(content);
  
  // 再截取
  if (sanitized.length <= maxLength) return sanitized;
  
  return sanitized.substring(0, maxLength) + '...';
}

/**
 * 检查内容是否包含敏感信息（用于日志和调试）
 */
export function containsSensitiveInfo(content: string): {
  hasEmail: boolean;
  hasPhone: boolean;
  hasUrl: boolean;
} {
  if (!content) return { hasEmail: false, hasPhone: false, hasUrl: false };
  
  return {
    hasEmail: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(content),
    hasPhone: /\+?\d[\d\s().-]{6,}\d/.test(content),
    hasUrl: /https?:\/\/|www\./i.test(content),
  };
}
