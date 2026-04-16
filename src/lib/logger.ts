/**
 * 日志工具类
 * 提供结构化的日志记录功能，支持错误分类和自动诊断
 */

import fs from 'fs';
import path from 'path';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export enum ErrorCategory {
  P0_DATABASE = 'P0_DATABASE',
  P0_SMTP = 'P0_SMTP',
  P1_API_500 = 'P1_API_500',
  P1_AUTH = 'P1_AUTH',
  P2_PERFORMANCE = 'P2_PERFORMANCE',
  P2_WARNING = 'P2_WARNING',
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category?: ErrorCategory;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
  suggestions?: string[];
}

export interface ErrorPattern {
  name: string;
  pattern: RegExp;
  category: ErrorCategory;
  suggestions: string[];
}

// 错误模式定义
export const ERROR_PATTERNS: ErrorPattern[] = [
  {
    name: 'Prisma 连接错误',
    pattern: /Prisma\s+Client\s+unable\s+to\s+connect|DATABASE_URL|ECONNREFUSED.*prisma/i,
    category: ErrorCategory.P0_DATABASE,
    suggestions: [
      '检查 .env 文件中的 DATABASE_URL 配置',
      '确认数据库文件是否存在（.db 文件）',
      '运行 npx prisma generate 重新生成 Prisma Client',
      '检查数据库端口是否被占用',
    ],
  },
  {
    name: 'SMTP 连接错误',
    pattern: /SMTP|nodemailer|ECONNREFUSED.*25|ECONNREFUSED.*587|ECONNREFUSED.*465|Authentication\s+failed|Invalid\s+login/i,
    category: ErrorCategory.P0_SMTP,
    suggestions: [
      '检查 .env 中的 SMTP_HOST、SMTP_PORT 配置',
      '验证 SMTP 用户名和密码是否正确',
      '确认 SMTP 服务器是否可访问',
      '检查防火墙是否阻止了 SMTP 端口',
      '运行 node scripts/test-smtp.js 测试 SMTP 连接',
    ],
  },
  {
    name: 'API 500 错误',
    pattern: /HTTP\s+500|Internal\s+Server\s+Error|statusCode.*500/i,
    category: ErrorCategory.P1_API_500,
    suggestions: [
      '查看完整的错误堆栈',
      '检查 API 路由参数是否正确',
      '验证请求数据格式',
      '检查数据库查询是否超时',
    ],
  },
  {
    name: '认证失败',
    pattern: /Unauthorized|401|Authentication.*failed|Invalid.*token|JWT.*expired/i,
    category: ErrorCategory.P1_AUTH,
    suggestions: [
      '检查 JWT_SECRET 配置',
      '验证用户 token 是否过期',
      '确认认证中间件是否正确配置',
      '检查用户会话状态',
    ],
  },
  {
    name: '性能警告',
    pattern: /slow|timeout|performance|memory\s+usage|high\s+cpu/i,
    category: ErrorCategory.P2_PERFORMANCE,
    suggestions: [
      '优化数据库查询',
      '添加适当的索引',
      '检查内存泄漏',
      '考虑添加缓存层',
    ],
  },
  {
    name: '一般警告',
    pattern: /warning|deprecated|deprecation/i,
    category: ErrorCategory.P2_WARNING,
    suggestions: [
      '查看警告详情',
      '更新过时的依赖',
      '修复已弃用的 API 调用',
    ],
  },
];

class Logger {
  private logDir: string;
  private errorLogPath: string;

  constructor() {
    const logDir = path.join(process.cwd(), '.workbuddy', 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    this.logDir = logDir;
    this.errorLogPath = path.join(logDir, `error-${this.getTodayDate()}.md`);
  }

  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  private formatTimestamp(): string {
    const date = new Date();
    // 转换为北京时间（UTC+8）
    const beijingTime = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    return beijingTime.toISOString().replace('Z', '+08:00');
  }

  private categorizeError(message: string): ErrorCategory | undefined {
    for (const pattern of ERROR_PATTERNS) {
      if (pattern.pattern.test(message)) {
        return pattern.category;
      }
    }
    return undefined;
  }

  private getSuggestions(message: string): string[] {
    for (const pattern of ERROR_PATTERNS) {
      if (pattern.pattern.test(message)) {
        return pattern.suggestions;
      }
    }
    return ['检查相关配置文件', '查看详细错误堆栈'];
  }

  /**
   * 记录日志
   */
  log(level: LogLevel, message: string, details?: any): void {
    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level,
      message,
      details,
    };

    // 控制台输出
    const consoleMethod = level === LogLevel.ERROR ? 'error' : level === LogLevel.WARN ? 'warn' : 'log';
    console[consoleMethod](`[${entry.timestamp}] ${level}: ${message}`);

    // 错误日志需要额外记录
    if (level === LogLevel.ERROR) {
      entry.category = this.categorizeError(message);
      entry.suggestions = this.getSuggestions(message);
      this.writeErrorLog(entry);
    }
  }

  /**
   * 记录错误
   */
  error(message: string, error?: Error, details?: any): void {
    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level: LogLevel.ERROR,
      category: this.categorizeError(message),
      message,
      details,
      stack: error?.stack,
      suggestions: this.getSuggestions(message),
    };

    // console.error(`[${entry.timestamp}] ERROR: ${message}`);
    if (error?.stack) {
      // console.error(error.stack);
    }

    this.writeErrorLog(entry);
  }

  /**
   * 记录警告
   */
  warn(message: string, details?: any): void {
    this.log(LogLevel.WARN, message, details);
  }

  /**
   * 记录信息
   */
  info(message: string, details?: any): void {
    this.log(LogLevel.INFO, message, details);
  }

  /**
   * 记录调试信息
   */
  debug(message: string, details?: any): void {
    this.log(LogLevel.DEBUG, message, details);
  }

  /**
   * 写入错误日志文件
   */
  private writeErrorLog(entry: LogEntry): void {
    try {
      const date = this.getTodayDate();
      const filePath = path.join(this.logDir, `error-${date}.md`);

      // 如果文件不存在，创建并写入标题
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(
          filePath,
          `# 错误日志 - ${date}\n\n`,
          'utf-8'
        );
      }

      // 格式化日志条目
      const logContent = this.formatLogEntry(entry);
      fs.appendFileSync(filePath, logContent, 'utf-8');
    } catch (err) {
      // console.error('写入错误日志失败:', err);
    }
  }

  /**
   * 格式化日志条目为 Markdown
   */
  private formatLogEntry(entry: LogEntry): string {
    let content = `## ${entry.timestamp}\n\n`;
    content += `**级别**: ${entry.level}\n`;

    if (entry.category) {
      content += `**分类**: ${entry.category}\n`;
    }

    content += `\n**错误信息**:\n\`\`\`\n${entry.message}\n\`\`\`\n\n`;

    if (entry.stack) {
      content += `**堆栈跟踪**:\n\`\`\`\n${entry.stack}\n\`\`\`\n\n`;
    }

    if (entry.details) {
      content += `**详细信息**:\n\`\`\`json\n${JSON.stringify(entry.details, null, 2)}\n\`\`\`\n\n`;
    }

    if (entry.suggestions && entry.suggestions.length > 0) {
      content += `**建议修复方案**:\n`;
      entry.suggestions.forEach((suggestion, i) => {
        content += `${i + 1}. ${suggestion}\n`;
      });
      content += '\n';
    }

    content += `---\n\n`;
    return content;
  }

  /**
   * 获取今日错误日志
   */
  getTodayErrorLog(): string | null {
    const filePath = this.errorLogPath;
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
    return null;
  }
}

// 导出单例
export const logger = new Logger();
