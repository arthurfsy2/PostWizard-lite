import '@testing-library/jest-dom';
import { vi, beforeAll, afterAll } from 'vitest';

// Mock global fetch
global.fetch = vi.fn();

// Mock console.error 在某些测试中避免噪音
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    // 忽略某些特定的警告
    if (args[0]?.includes?.('Warning:')) {
      return;
    }
    originalConsoleError.apply(console, args);
  };
});

afterAll(() => {
  console.error = originalConsoleError;
});

// 设置时区为 UTC，避免时区问题
process.env.TZ = 'UTC';
