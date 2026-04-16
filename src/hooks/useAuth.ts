// 开源版：认证 hook stub（本地单用户模式）
export function useAuth() {
  return {
    token: 'local-token',
    user: {
      id: 'local',
      email: 'local@postwizard.local',
      name: 'Local User',
      isPaidUser: true,
      plan: 'FREE',
      freeQuota: 9999,
      freeUsedCount: 0,
    },
    isLoading: false,
    error: null,
    login: () => {},
    logout: () => {},
    fetchUser: async () => {},
  };
}
