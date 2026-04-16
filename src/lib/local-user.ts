/**
 * 本地单用户模式常量
 * 开源版使用固定的本地用户ID，无需登录
 */
export const LOCAL_USER_ID = "local";

/**
 * 获取当前用户ID（本地模式始终返回固定值）
 * 用于替换原来的 getCurrentUser() 调用
 */
export function getLocalUserId(): string {
  return LOCAL_USER_ID;
}

/**
 * 模拟用户对象（用于兼容需要用户信息的场景）
 */
export function getLocalUser() {
  return {
    id: LOCAL_USER_ID,
    email: "local@postwizard.local",
    name: "Local User",
    role: "USER" as const,
    plan: "FREE" as const,
  };
}
