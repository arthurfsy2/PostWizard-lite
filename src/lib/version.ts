// 版本信息 - 由构建脚本自动注入
export const VERSION = process.env.NEXT_PUBLIC_GIT_HASH || 'dev';
export const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString();
