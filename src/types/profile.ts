/**
 * 个人要素页面类型定义
 */

// 用户类型
export type UserType = 'expert' | 'newbie';

// 个人要素数据（与后端 API 兼容）
export interface ProfileData {
  id?: string;
  userId?: string;
  userType?: UserType;       // 前端状态，不需要存储到后端
  aboutMe: string;           // 个人简介（英文）
  casualNotes: string;       // 随心记（中文）
  casualNotesEn?: string;    // AI翻译的英文版本
  tags: string[];            // AI 识别标签
  createdAt?: string;
  updatedAt?: string;
}

// 翻译请求（与后端 API 匹配）
export interface TranslateRequest {
  aboutMe: string;
  casualNotes: string;
}

// Token 使用情况
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// 翻译响应（与后端 API 匹配）
export interface TranslateResponse {
  success?: boolean;
  translation: string;
  tags: string[];
  usage?: TokenUsage;
}

// 保存个人要素请求（与后端 API 兼容）
export interface SaveProfileRequest {
  aboutMe: string;
  casualNotes?: string;
  casualNotesEn?: string;
  tags?: string[];
}

// 前端完整的 profile 状态（包含本地状态 userType）
export interface SaveProfileWithTypeRequest extends SaveProfileRequest {
  userType: UserType;
}

// 模板提示项
export interface TemplateHint {
  type: string;
  icon: string;
  hint: string;
}

// 新手模板提示列表
export const NEWBIE_TEMPLATES: TemplateHint[] = [
  { type: '兴趣爱好', icon: '🎨', hint: '我平时喜欢...' },
  { type: '收藏偏好', icon: '🏺', hint: '我喜欢收集...' },
  { type: '旅行经历', icon: '✈️', hint: '最近去了...' },
  { type: '学习/工作', icon: '📚', hint: '我是一名...' },
  { type: '宠物/家庭', icon: '🏠', hint: '我家有...' },
];

// 检测是否包含中文
export const containsChinese = (text: string): boolean => {
  return /[\u4e00-\u9fa5]/.test(text);
};

// 检测是否包含英文
export const containsEnglish = (text: string): boolean => {
  return /[a-zA-Z]/.test(text);
};
