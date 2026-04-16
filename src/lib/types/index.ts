export interface EmailConfig {
  id: string;
  name: string;
  email: string;
  imapHost: string;
  imapPort: number;
  imapUsername: string;
  imapPassword: string;
  useTLS: boolean;
  rejectUnauthorized: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Postcard {
  id: string;
  emailId: string;
  postcardId: string;
  recipientName: string;
  recipientCountry: string;
  recipientCity: string;
  recipientAddress: string;
  recipientAge?: number;
  recipientGender?: string;
  recipientInterests?: string;
  recipientBio?: string;
  status: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MatchedMaterial {
  category: string;
  content: string;
  matchedKeyword: string;
}

export interface GeneratedContent {
  id: string;
  emailId?: string;
  postcardId?: string;
  contentTitle: string;
  contentBody: string;
  contentEn?: string;
  contentZh?: string;
  matchedMaterials?: MatchedMaterial[];
  contentType: string;
  language: string;
  tone?: string;
  weather?: string;
  localNews?: string;
  personalStory?: string;
  tags?: string;
  wordCount?: number;
  isHandwritten: boolean;
  isFavorite: boolean;
  usedTokens?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PostcardContent {
  postcardId: string;
  recipientName: string;
  country: string;
  city: string;
  senderCity: string;
  greeting: string;
  body: string;
  closing: string;
  weather: string;
  localCulture: string;
  personalTouch: string;
}
