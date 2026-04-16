/**
 * Mock Data Configuration
 * 用于测试的 Mock 用户和邮件数据
 */

// ============================================
// Mock Users
// ============================================

export const mockUsers = {
  freeUser: {
    id: 'user_free_001',
    email: 'test@example.com',
    plan: 'free',
    freeUsedCount: 0,
    planExpiresAt: null,
    freeResetAt: new Date(),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  },
  proUser: {
    id: 'user_pro_001',
    email: 'pro@example.com',
    plan: 'pro',
    freeUsedCount: 0,
    planExpiresAt: new Date('2027-01-01'),
    freeResetAt: new Date(),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  },
  expiredProUser: {
    id: 'user_expired_001',
    email: 'expired@example.com',
    plan: 'pro',
    freeUsedCount: 0,
    planExpiresAt: new Date('2025-01-01'), // 已过期
    freeResetAt: new Date(),
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
};

// ============================================
// Mock Sessions
// ============================================

export const mockSessions = {
  validSession: {
    id: 'session_001',
    userId: 'user_free_001',
    token: 'valid_token_123456789',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天后
    createdAt: new Date(),
  },
  expiredSession: {
    id: 'session_002',
    userId: 'user_free_001',
    token: 'expired_token_123456789',
    expiresAt: new Date('2025-01-01'), // 已过期
    createdAt: new Date('2025-01-01'),
  },
};

// ============================================
// Mock Verification Codes
// ============================================

export const mockVerificationCodes = {
  valid: {
    id: 'vc_001',
    email: 'test@example.com',
    code: '123456',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10分钟后
    used: false,
    createdAt: new Date(),
  },
  expired: {
    id: 'vc_002',
    email: 'test@example.com',
    code: '654321',
    expiresAt: new Date('2025-01-01'), // 已过期
    used: false,
    createdAt: new Date('2025-01-01'),
  },
  used: {
    id: 'vc_003',
    email: 'test@example.com',
    code: '111111',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    used: true, // 已使用
    createdAt: new Date(),
  },
};

// ============================================
// Mock Emails (Postcrossing)
// ============================================

export const mockEmails = {
  // 来自美国的明信片
  emailFromUSA: {
    id: 'email_001',
    userId: 'user_free_001',
    postcardId: 'US-1234567',
    from: 'postcrossing.com <noreply@postcrossing.com>',
    fromName: 'Postcrossing.com',
    to: 'test@example.com',
    subject: 'You have received a new postcard! US-1234567',
    body: `Hello!

You have received a new postcard from the United States!

From: Sarah from New York, USA
Registration date: 2024-05-15
Sent: 5 cards

Message:
Hi! I'm Sarah, a postcrossing enthusiast from NYC. I love sending postcards to people around the world! This card shows the beautiful skyline of Manhattan. I hope you enjoy it!

Your postcrossing ID: CN-9876543
Sent: 25 postcards
Received: 28 postcards
Country: China (🇨🇳)
City: Shenzhen
Registration: 2023-01-15

Happy postcrossing!
The Postcrossing Team`,
    receivedAt: new Date('2026-03-25'),
    createdAt: new Date('2026-03-25'),
  },

  // 来自德国的明信片
  emailFromGermany: {
    id: 'email_002',
    userId: 'user_free_001',
    postcardId: 'DE-9876543',
    from: 'postcrossing.com <noreply@postcrossing.com>',
    fromName: 'Postcrossing.com',
    to: 'test@example.com',
    subject: 'You have received a new postcard! DE-9876543',
    body: `Hello!

You have received a new postcard from Germany!

From: Hans from Berlin, Germany
Registration date: 2022-08-20
Sent: 156 cards

Message:
Grüß Gott! My name is Hans, I'm a collector of vintage postcards and stamps. This card features the Brandenburg Gate in Berlin. I hope it brings you joy!

Interests: vintage stamps, photography, traveling
I'm a postcrossing veteran with over 150 cards sent!

Your postcrossing ID: CN-9876543
Country: China (🇨🇳)
City: Shenzhen`,
    receivedAt: new Date('2026-03-26'),
    createdAt: new Date('2026-03-26'),
  },

  // 新手的明信片
  emailFromNewMember: {
    id: 'email_003',
    userId: 'user_free_001',
    postcardId: 'JP-5555555',
    from: 'postcrossing.com <noreply@postcrossing.com>',
    fromName: 'Postcrossing.com',
    to: 'test@example.com',
    subject: 'You have received a new postcard! JP-5555555',
    body: `Hello!

You have received a new postcard from Japan!

From: Yuki from Tokyo, Japan
Registration date: 2026-03-01
Sent: 1 card (new member!)

Message:
Konnichiwa! This is my first postcrossing card! I'm very excited to send my first postcard to someone in China. I just joined postcrossing last week and this is my first exchange. Please forgive any mistakes!

I love anime and manga, and I'm learning Chinese at university.

Your postcrossing ID: CN-9876543
Country: China (🇨🇳)
City: Shenzhen`,
    receivedAt: new Date('2026-03-27'),
    createdAt: new Date('2026-03-27'),
  },
};

// ============================================
// Mock Email Configs
// ============================================

export const mockEmailConfigs = {
  validConfig: {
    id: 'config_001',
    userId: 'user_free_001',
    emailAccount: 'test@gmail.com',
    emailPassword: 'mock_password',
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465,
    isActive: true,
    lastSyncAt: new Date('2026-03-27'),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-03-27'),
  },
  inactiveConfig: {
    id: 'config_002',
    userId: 'user_free_001',
    emailAccount: 'inactive@gmail.com',
    emailPassword: 'mock_password',
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465,
    isActive: false,
    lastSyncAt: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
};

// ============================================
// Mock Recipients
// ============================================

export const mockRecipients = {
  recipient1: {
    id: 'rec_001',
    userId: 'user_free_001',
    postcardId: 'US-1234567',
    name: 'Sarah',
    country: 'United States',
    countryCode: 'US',
    city: 'New York',
    address: '123 Main St, New York, NY 10001',
    interests: ['photography', 'traveling'],
    postcrossingExperience: 'experienced',
    personalInfo: {
      hobbies: ['photography', 'traveling', 'reading'],
      occupation: 'Teacher',
    },
    emailId: 'email_001',
    createdAt: new Date('2026-03-25'),
  },
  recipient2: {
    id: 'rec_002',
    userId: 'user_free_001',
    postcardId: 'DE-9876543',
    name: 'Hans',
    country: 'Germany',
    countryCode: 'DE',
    city: 'Berlin',
    address: 'Unter den Linden 10, 10117 Berlin',
    interests: ['vintage stamps', 'photography', 'traveling'],
    postcrossingExperience: 'veteran',
    personalInfo: {
      hobbies: ['vintage stamps', 'photography', 'traveling', 'collecting'],
      occupation: 'Museum Curator',
    },
    emailId: 'email_002',
    createdAt: new Date('2026-03-26'),
  },
  recipient3: {
    id: 'rec_003',
    userId: 'user_free_001',
    postcardId: 'JP-5555555',
    name: 'Yuki',
    country: 'Japan',
    countryCode: 'JP',
    city: 'Tokyo',
    address: '1-1 Shibuya, Shibuya-ku, Tokyo 150-0002',
    interests: ['anime', 'manga'],
    postcrossingExperience: 'new',
    personalInfo: {
      hobbies: ['anime', 'manga', 'learning languages'],
      occupation: 'University Student',
    },
    emailId: 'email_003',
    createdAt: new Date('2026-03-27'),
  },
};

// ============================================
// Helper Functions
// ============================================

/**
 * 创建一个有效的用户 session
 */
export function createMockSession(userId: string, expiresInDays: number = 30) {
  return {
    id: `session_${Date.now()}`,
    userId,
    token: `token_${Math.random().toString(36).substring(2, 15)}`,
    expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
  };
}

/**
 * 创建一个有效的验证码
 */
export function createMockVerificationCode(email: string, code: string = '123456') {
  return {
    id: `vc_${Date.now()}`,
    email,
    code,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    used: false,
    createdAt: new Date(),
  };
}

/**
 * 创建一个模拟的 Postcrossing 邮件
 */
export function createMockPostcrossingEmail(options: {
  postcardId: string;
  fromName: string;
  fromCountry: string;
  fromCity: string;
  message: string;
  interests?: string[];
  experience?: string;
}) {
  const {
    postcardId,
    fromName,
    fromCountry,
    fromCity,
    message,
    interests = [],
    experience = 'experienced',
  } = options;

  return {
    id: `email_${Date.now()}`,
    userId: 'user_free_001',
    postcardId,
    from: 'postcrossing.com <noreply@postcrossing.com>',
    fromName: 'Postcrossing.com',
    to: 'test@example.com',
    subject: `You have received a new postcard! ${postcardId}`,
    body: `Hello!

You have received a new postcard from ${fromCountry}!

From: ${fromName} from ${fromCity}, ${fromCountry}
Sent: 5 cards

Message:
${message}

${interests.length > 0 ? `Interests: ${interests.join(', ')}` : ''}
I'm ${experience === 'new' ? 'new to postcrossing' : 'a postcrossing ' + experience}!

Your postcrossing ID: CN-9876543
Country: China (🇨🇳)
City: Shenzhen`,
    receivedAt: new Date(),
    createdAt: new Date(),
  };
}
