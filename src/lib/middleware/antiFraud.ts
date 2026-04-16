import { NextRequest, NextResponse } from 'next/server';

/**
 * 防刷检测配置
 */
const ANTI_FRAUD_CONFIG = {
  // IP限制：24小时内同IP最多注册数
  maxRegistrationsPerIpPerDay: 3,
  
  // 设备指纹限制：24小时内同设备最多注册数
  maxRegistrationsPerFingerprintPerDay: 2,
  
  // 邀请频率限制：单个邀请码每小时最多被使用次数
  maxReferralsPerCodePerHour: 10,
  
  // 时间窗口（毫秒）
  timeWindowMs: 24 * 60 * 60 * 1000, // 24小时
  hourWindowMs: 60 * 60 * 1000, // 1小时
};

/**
 * 客户端IP记录
 * 实际生产环境应该使用 Redis 或数据库
 */
class InMemoryRateLimiter {
  private records = new Map<string, { count: number; timestamp: number }>();
  private maxSize = 10000; // 最大记录数，防止内存溢出

  /**
   * 检查并增加计数
   */
  checkAndIncrement(key: string, maxCount: number, windowMs: number): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
  } {
    const now = Date.now();
    const record = this.records.get(key);

    // 清理过期记录
    if (record && now - record.timestamp > windowMs) {
      this.records.delete(key);
    }

    // 获取当前计数
    const currentCount = this.records.get(key)?.count || 0;

    if (currentCount >= maxCount) {
      const resetTime = (this.records.get(key)?.timestamp || now) + windowMs;
      return {
        allowed: false,
        remaining: 0,
        resetTime,
      };
    }

    // 增加计数
    this.records.set(key, {
      count: currentCount + 1,
      timestamp: this.records.get(key)?.timestamp || now,
    });

    // 清理旧记录（如果超过最大大小）
    if (this.records.size > this.maxSize) {
      const oldestKey = this.records.keys().next().value;
      if (oldestKey) {
        this.records.delete(oldestKey);
      }
    }

    return {
      allowed: true,
      remaining: maxCount - currentCount - 1,
      resetTime: now + windowMs,
    };
  }

  /**
   * 获取当前计数
   */
  getCount(key: string): number {
    return this.records.get(key)?.count || 0;
  }

  /**
   * 重置计数
   */
  reset(key: string): void {
    this.records.delete(key);
  }

  /**
   * 清理过期记录
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.records.entries()) {
      if (now - record.timestamp > ANTI_FRAUD_CONFIG.timeWindowMs) {
        this.records.delete(key);
      }
    }
  }
}

// 全局限流器实例
const rateLimiter = new InMemoryRateLimiter();

// 定期清理（每10分钟）
if (typeof global !== 'undefined') {
  setInterval(() => rateLimiter.cleanup(), 10 * 60 * 1000);
}

/**
 * 获取客户端真实IP
 */
export function getClientIp(request: NextRequest): string {
  // 尝试从各种Header获取真实IP
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // 开发环境返回固定值
  return '127.0.0.1';
}

/**
 * 生成设备指纹（基于请求头）
 */
export function generateDeviceFingerprint(request: NextRequest): string {
  const userAgent = request.headers.get('user-agent') || '';
  const acceptLang = request.headers.get('accept-language') || '';
  const acceptEncoding = request.headers.get('accept-encoding') || '';
  const accept = request.headers.get('accept') || '';

  // 组合特征
  const fingerprint = `${userAgent}|${acceptLang}|${acceptEncoding}|${accept}`;
  
  // 简单哈希（实际生产环境可用更复杂的算法）
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return `fp_${Math.abs(hash).toString(16)}`;
}

/**
 * 检查IP限制
 */
export function checkIpLimit(ip: string): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
} {
  const key = `ip:${ip}`;
  return rateLimiter.checkAndIncrement(
    key,
    ANTI_FRAUD_CONFIG.maxRegistrationsPerIpPerDay,
    ANTI_FRAUD_CONFIG.timeWindowMs
  );
}

/**
 * 检查设备指纹限制
 */
export function checkFingerprintLimit(fingerprint: string): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
} {
  const key = `fp:${fingerprint}`;
  return rateLimiter.checkAndIncrement(
    key,
    ANTI_FRAUD_CONFIG.maxRegistrationsPerFingerprintPerDay,
    ANTI_FRAUD_CONFIG.timeWindowMs
  );
}

/**
 * 检查邀请码使用频率
 */
export function checkReferralCodeLimit(code: string): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
} {
  const key = `ref:${code}`;
  return rateLimiter.checkAndIncrement(
    key,
    ANTI_FRAUD_CONFIG.maxReferralsPerCodePerHour,
    ANTI_FRAUD_CONFIG.hourWindowMs
  );
}

/**
 * 防刷检测中间件
 */
export async function antiFraudMiddleware(
  request: NextRequest,
  options: {
    checkIp?: boolean;
    checkFingerprint?: boolean;
    checkReferralCode?: string;
  } = {}
): Promise<NextResponse | null> {
  const { checkIp = true, checkFingerprint = true, checkReferralCode } = options;

  // IP检测
  if (checkIp) {
    const ip = getClientIp(request);
    const ipCheck = checkIpLimit(ip);
    
    if (!ipCheck.allowed) {
      return NextResponse.json(
        {
          error: '操作过于频繁，请稍后重试',
          code: 'RATE_LIMIT_IP',
          resetTime: new Date(ipCheck.resetTime).toISOString(),
        },
        { status: 429 }
      );
    }
  }

  // 设备指纹检测
  if (checkFingerprint) {
    const fingerprint = generateDeviceFingerprint(request);
    const fpCheck = checkFingerprintLimit(fingerprint);
    
    if (!fpCheck.allowed) {
      return NextResponse.json(
        {
          error: '设备操作过于频繁，请稍后重试',
          code: 'RATE_LIMIT_DEVICE',
          resetTime: new Date(fpCheck.resetTime).toISOString(),
        },
        { status: 429 }
      );
    }
  }

  // 邀请码频率检测
  if (checkReferralCode) {
    const codeCheck = checkReferralCodeLimit(checkReferralCode);
    
    if (!codeCheck.allowed) {
      return NextResponse.json(
        {
          error: '该邀请链接访问过于频繁，请稍后重试',
          code: 'RATE_LIMIT_REFERRAL',
          resetTime: new Date(codeCheck.resetTime).toISOString(),
        },
        { status: 429 }
      );
    }
  }

  return null; // 通过检测
}

/**
 * 记录注册行为（用于防刷统计）
 */
export function recordRegistration(
  ip: string,
  fingerprint: string,
  referralCode?: string
): void {
  // 已经在 checkAndIncrement 中记录了
  // console.log('[AntiFraud] Registration recorded:', {
  //   ip,
  //   fingerprint: fingerprint.slice(0, 20) + '...',
  //   referralCode,
  //   timestamp: new Date().toISOString(),
  // });
}

/**
 * 获取防刷统计
 */
export function getAntiFraudStats(): {
  totalRecords: number;
  config: typeof ANTI_FRAUD_CONFIG;
} {
  return {
    totalRecords: 0, // 实际应从 rateLimiter 获取
    config: { ...ANTI_FRAUD_CONFIG },
  };
}

export { ANTI_FRAUD_CONFIG, rateLimiter };
