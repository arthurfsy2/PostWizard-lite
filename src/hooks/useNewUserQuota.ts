// 开源版：额度 hook stub（本地模式无限制）
export function useNewUserQuota() {
  return {
    newUserQuota: 999,
    isLoading: false,
    error: null,
  };
}

export function useIsPaidUser() {
  return {
    isPaidUser: true,
    isLoading: false,
  };
}
