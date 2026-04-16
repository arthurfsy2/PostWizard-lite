import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getClientIp,
  generateDeviceFingerprint,
  checkIpLimit,
  checkFingerprintLimit,
  checkReferralCodeLimit,
  rateLimiter,
  ANTI_FRAUD_CONFIG,
} from '../antiFraud';
import { NextRequest } from 'next/server';

// Mock NextRequest
const createMockRequest = (headers: Record<string, string> = {}): NextRequest => {
  return {
    headers: {
      get: (key: string) => headers[key] || null,
    },
  } as unknown as NextRequest;
};

describe('AntiFraud', () => {
  beforeEach(() => {
    // 重置限流器
    // @ts-ignore
    rateLimiter.records.clear();
  });

  describe('getClientIp', () => {
    it('应该从 x-forwarded-for 获取IP', () => {
      const request = createMockRequest({
        'x-forwarded-for': '192.168.1.1, 10.0.0.1',
      });

      const ip = getClientIp(request);
      expect(ip).toBe('192.168.1.1');
    });

    it('应该从 x-real-ip 获取IP', () => {
      const request = createMockRequest({
        'x-real-ip': '192.168.1.2',
      });

      const ip = getClientIp(request);
      expect(ip).toBe('192.168.1.2');
    });

    it('应该从 cf-connecting-ip 获取IP', () => {
      const request = createMockRequest({
        'cf-connecting-ip': '192.168.1.3',
      });

      const ip = getClientIp(request);
      expect(ip).toBe('192.168.1.3');
    });

    it('没有代理头时应该返回本地IP', () => {
      const request = createMockRequest({});

      const ip = getClientIp(request);
      expect(ip).toBe('127.0.0.1');
    });
  });

  describe('generateDeviceFingerprint', () => {
    it('应该生成一致的指纹', () => {
      const headers = {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'accept-encoding': 'gzip, deflate, br',
        'accept': 'text/html,application/xhtml+xml',
      };
      const request = createMockRequest(headers);

      const fingerprint1 = generateDeviceFingerprint(request);
      const fingerprint2 = generateDeviceFingerprint(request);

      expect(fingerprint1).toBe(fingerprint2);
      expect(fingerprint1).toMatch(/^fp_[a-f0-9]+$/);
    });

    it('不同请求头应该生成不同指纹', () => {
      const request1 = createMockRequest({
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0)',
        'accept-language': 'zh-CN',
      });
      const request2 = createMockRequest({
        'user-agent': 'Mozilla/5.0 (Macintosh)',
        'accept-language': 'en-US',
      });

      const fingerprint1 = generateDeviceFingerprint(request1);
      const fingerprint2 = generateDeviceFingerprint(request2);

      expect(fingerprint1).not.toBe(fingerprint2);
    });
  });

  describe('checkIpLimit', () => {
    it('应该允许在限制内的IP', () => {
      const result = checkIpLimit('192.168.1.1');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(ANTI_FRAUD_CONFIG.maxRegistrationsPerIpPerDay - 1);
    });

    it('应该限制超过阈值的IP', () => {
      const ip = '192.168.1.1';

      // 达到限制
      for (let i = 0; i < ANTI_FRAUD_CONFIG.maxRegistrationsPerIpPerDay; i++) {
        checkIpLimit(ip);
      }

      const result = checkIpLimit(ip);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('应该区分不同IP', () => {
      const result1 = checkIpLimit('192.168.1.1');
      const result2 = checkIpLimit('192.168.1.2');

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
    });
  });

  describe('checkFingerprintLimit', () => {
    it('应该允许在限制内的设备指纹', () => {
      const result = checkFingerprintLimit('fp_test123');

      expect(result.allowed).toBe(true);
    });

    it('应该限制超过阈值的设备指纹', () => {
      const fp = 'fp_test456';

      // 达到限制（设备限制比IP更严格）
      for (let i = 0; i < ANTI_FRAUD_CONFIG.maxRegistrationsPerFingerprintPerDay; i++) {
        checkFingerprintLimit(fp);
      }

      const result = checkFingerprintLimit(fp);

      expect(result.allowed).toBe(false);
    });
  });

  describe('checkReferralCodeLimit', () => {
    it('应该允许在限制内的邀请码访问', () => {
      const result = checkReferralCodeLimit('code123');

      expect(result.allowed).toBe(true);
    });

    it('应该限制过于频繁的邀请码访问', () => {
      const code = 'code456';

      // 达到每小时限制
      for (let i = 0; i < ANTI_FRAUD_CONFIG.maxReferralsPerCodePerHour; i++) {
        checkReferralCodeLimit(code);
      }

      const result = checkReferralCodeLimit(code);

      expect(result.allowed).toBe(false);
    });
  });

  describe('rateLimiter', () => {
    it('应该正确记录计数', () => {
      const key = 'test_key';

      expect(rateLimiter.getCount(key)).toBe(0);

      rateLimiter.checkAndIncrement(key, 10, 3600000);
      expect(rateLimiter.getCount(key)).toBe(1);

      rateLimiter.checkAndIncrement(key, 10, 3600000);
      expect(rateLimiter.getCount(key)).toBe(2);
    });

    it('应该支持重置计数', () => {
      const key = 'test_reset';

      rateLimiter.checkAndIncrement(key, 10, 3600000);
      expect(rateLimiter.getCount(key)).toBe(1);

      rateLimiter.reset(key);
      expect(rateLimiter.getCount(key)).toBe(0);
    });
  });
});
