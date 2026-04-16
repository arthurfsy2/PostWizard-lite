/**
 * 个人要素 API Hooks
 * 使用 React Query 进行数据获取和状态管理
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/fetch';
import type { 
  ProfileData, 
  TranslateRequest, 
  TranslateResponse, 
  SaveProfileRequest 
} from '@/types/profile';

const PROFILE_KEY = 'profile';

/**
 * 从 API 响应转换为 ProfileData
 */
const mapApiToProfileData = (apiData: any): ProfileData => ({
  aboutMe: apiData.aboutMe || '',
  casualNotes: apiData.casualNotes || '',
  casualNotesEn: apiData.casualNotesEn || '',
  tags: Array.isArray(apiData.tags) ? apiData.tags : JSON.parse(apiData.tags || '[]'),
  createdAt: apiData.createdAt,
  updatedAt: apiData.updatedAt,
});

/**
 * 获取用户个人要素
 */
export function useProfile() {
  return useQuery({
    queryKey: [PROFILE_KEY],
    queryFn: async (): Promise<ProfileData> => {
      const response = await apiFetch('/api/profile');

      if (!response.ok) {
        if (response.status === 404) {
          // 用户还没有 profile，返回默认值
          return {
            aboutMe: '',
            casualNotes: '',
            casualNotesEn: '',
            tags: [],
          };
        }
        throw new Error('获取个人要素失败');
      }
      
      const result = await response.json();
      // 后端返回 { profile: {...} } 格式
      if (result.profile) {
        return mapApiToProfileData(result.profile);
      }
      return result.data;
    },
    staleTime: 5 * 60 * 1000, // 5 分钟缓存
  });
}

/**
 * 翻译并提取标签
 */
export function useTranslateProfile() {
  return useMutation({
    mutationFn: async (data: TranslateRequest): Promise<TranslateResponse> => {
      const response = await apiFetch('/api/profile/translate', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '翻译失败');
      }
      
      return response.json();
    },
  });
}

/**
 * 保存个人要素
 */
export function useSaveProfile() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: SaveProfileRequest): Promise<ProfileData> => {
      const response = await apiFetch('/api/profile', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '保存失败');
      }
      
      const result = await response.json();
      // 后端返回 { success, profile: {...} } 格式
      if (result.profile) {
        return mapApiToProfileData(result.profile);
      }
      return result.data;
    },
    onSuccess: (data) => {
      // 保存成功后静默更新缓存，不触发额外的 GET 请求
      queryClient.setQueryData([PROFILE_KEY], data);
      // 移除 invalidateQueries 避免重复请求
    },
  });
}
