/**
 * 全局类型定义
 */

export interface EmailConfig {
  id?: string;
  name: string;
  email: string;
  imapHost: string;
  imapPort: number;
  imapUsername: string;
  imapPassword: string;
  folderPath?: string;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SentCardContent {
  id: string;
  userId: string;
  content: string;
  type: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ArrivalReply {
  id: string;
  userId: string;
  postcardId: string;
  destinationCountry: string;
  destinationCity?: string;
  recipientName?: string;
  recipientEmail?: string;
  travelDays?: number;
  distance?: number;
  message?: string;
  arrivedAt?: Date;
  emailDate?: Date;
  emailMessageId?: string;
  rawSubject?: string;
  rawContent?: string;
  status: 'pending' | 'parsed' | 'failed';
  parseError?: string;
  createdAt: Date;
  updatedAt: Date;
  // 关联 MessageAnalysis 数据
  messageAnalysis?: {
    translation?: string;
    aiScore?: number;
    primaryCategory?: string;
    emotion?: string;
    tags?: string;
  } | null;
}
