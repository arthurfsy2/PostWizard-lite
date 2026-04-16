/**
 * Schema 字段验证工具（开发环境专用）
 * 
 * 用于在开发环境下检查代码中使用的字段是否在 Prisma Schema 中定义
 * 生产环境下自动禁用，不影响性能
 */

// 定义所有模型的 Schema 字段
const SCHEMA_FIELDS: Record<string, string[]> = {
  GeneratedContent: [
    'id',
    'postcardId',
    'userId',
    'contentTitle',
    'contentBody',
    'contentType',
    'language',
    'tone',
    'isHandwritten',
    'usedTokens',
    'type',
    'content',
    'metadata',
    'createdAt',
    // 关系字段
    'postcard',
    'user',
  ],
  User: [
    'id',
    'email',
    'name',
    'password',
    'emailVerified',
    'image',
    'role',
    'plan',
    'planExpiresAt',
    'rewardDays',
    'postcardCount',
    'freeUsedCount',
    'freeResetAt',
    'bonusQuota',
    'lastActiveAt',
    'invitationCode',
    'invitedBy',
    'referralBonusQuota',
    'referrerId',
    'createdAt',
    'updatedAt',
    // 关系字段
    'Session',
    'Referral',
    'UserMaterial',
    'GeneratedContent',
    'Payment',
  ],
  Postcard: [
    'id',
    'userId',
    'postcardId',
    'recipientName',
    'recipientAddress',
    'recipientCountry',
    'recipientCity',
    'recipientAge',
    'recipientGender',
    'recipientInterests',
    'recipientBio',
    'status',
    'sentDate',
    'receivedDate',
    'content',
    'metadata',
    'createdAt',
    'updatedAt',
    // 关系字段
    'GeneratedContent',
  ],
  Session: [
    'id',
    'userId',
    'token',
    'createdAt',
    'expiresAt',
    // 关系字段
    'user',
  ],
  PastedEmail: [
    'id',
    'userId',
    'postcardId',
    'rawContent',
    'parsedData',
    'createdAt',
    // 关系字段
    'postcard',
  ],
  Payment: [
    'id',
    'userId',
    'amount',
    'currency',
    'status',
    'paymentMethod',
    'transactionId',
    'paidAt',
    'createdAt',
    'updatedAt',
    // 关系字段
    'user',
  ],
  Feedback: [
    'id',
    'userId',
    'type',
    'content',
    'email',
    'screenshot',
    'sentiment',
    'category',
    'priority',
    'rewardSuggestion',
    'status',
    'rewardAmount',
    'rewardDays',
    'processedAt',
    'processedBy',
    'notes',
    'githubIssueUrl',
    'githubIssueNumber',
    'issuePushedAt',
    'workbuddyEvaluatingAt',
    'createdAt',
    'updatedAt',
    // 关系字段
    'user',
  ],
  Referral: [
    'id',
    'referrerId',
    'refereeEmail',
    'code',
    'status',
    'reward',
    'claimedAt',
    'createdAt',
    // 关系字段
    'referrer',
  ],
  UserMaterial: [
    'id',
    'userId',
    'category',
    'content',
    'createdAt',
    'updatedAt',
    // 关系字段
    'user',
  ],
  QuotaLog: [
    'id',
    'userId',
    'action',
    'amount',
    'balanceAfter',
    'createdAt',
    // 关系字段
    'user',
  ],
  VisitLog: [
    'id',
    'ip',
    'userAgent',
    'path',
    'referer',
    'country',
    'city',
    'userId',
    'sessionId',
    'createdAt',
  ],
  VerificationCode: [
    'id',
    'email',
    'code',
    'type',
    'expiresAt',
    'createdAt',
  ],
  Template: [
    'id',
    'userId',
    'name',
    'content',
    'category',
    'createdAt',
    'updatedAt',
    // 关系字段
    'user',
  ],
  AdminLog: [
    'id',
    'adminId',
    'action',
    'targetType',
    'targetId',
    'details',
    'createdAt',
    // 关系字段
    'admin',
  ],
  Settings: [
    'id',
    'key',
    'value',
    'updatedAt',
  ],
  EmailConfig: [
    'id',
    'userId',
    'name',
    'host',
    'port',
    'secure',
    'authUser',
    'authPass',
    'createdAt',
    'updatedAt',
    // 关系字段
    'user',
  ],
  CardTemplate: [
    'id',
    'userId',
    'name',
    'type',
    'content',
    'createdAt',
    'updatedAt',
    // 关系字段
    'user',
  ],
  Email: [
    'id',
    'userId',
    'emailId',
    'from',
    'to',
    'subject',
    'content',
    'receivedAt',
    'createdAt',
    // 关系字段
    'user',
  ],
  ReceivedCard: [
    'id',
    'userId',
    'postcardId',
    'postcardIdConfirmed',
    'status',
    'receivedAt',
    'createdAt',
    // 关系字段
    'user',
  ],
};

export interface ValidationOptions {
  /** 上下文信息，用于错误提示 */
  context: string;
  /** 是否允许额外字段（默认 false） */
  allowExtraFields?: boolean;
}

/**
 * 验证对象字段是否在 Schema 中定义
 * 
 * @param modelName - Prisma 模型名称
 * @param data - 要验证的对象
 * @param options - 验证选项
 * 
 * @example
 * // API 路由中使用
 * const items = history.map((item) => {
 *   const result = {
 *     id: item.id,
 *     isFavorite: false,
 *     wordCount: item.contentBody.length,
 *   };
 *   
 *   validateFields('GeneratedContent', result, {
 *     context: 'GET /api/history',
 *     allowExtraFields: true, // 允许计算字段
 *   });
 *   
 *   return result;
 * });
 */
export function validateFields(
  modelName: string,
  data: Record<string, any>,
  options: ValidationOptions
) {
  // 仅开发环境启用
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  const schemaFields = SCHEMA_FIELDS[modelName];
  if (!schemaFields) {
    // console.warn(
    //   `⚠️ [Schema 验证] 未知模型：${modelName}`
    // );
    return;
  }

  const usedFields = Object.keys(data);
  const unknownFields: string[] = [];

  usedFields.forEach((field) => {
    if (!schemaFields.includes(field)) {
      unknownFields.push(field);
    }
  });

  if (unknownFields.length > 0) {
    if (options.allowExtraFields) {
      // 允许额外字段时，打印信息性提示
      // console.log(
      //   `ℹ️ [Schema 验证] ${options.context}: 使用额外字段`,
      //   unknownFields.join(', ')
      // );
    } else {
      // 不允许额外字段时，打印警告
      // console.warn(
      //   `⚠️ [Schema 验证] ${options.context}: 字段不在 Schema 中`,
      //   unknownFields.join(', ')
      // );
    }
  }
}

/**
 * 验证数组中的每个对象
 */
export function validateArrayFields<T extends Record<string, any>>(
  modelName: string,
  dataArray: T[],
  options: ValidationOptions
) {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  dataArray.forEach((data, index) => {
    validateFields(modelName, data, {
      ...options,
      context: `${options.context}[${index}]`,
    });
  });
}

/**
 * 获取模型的所有 Schema 字段（用于调试）
 */
export function getSchemaFields(modelName: string): string[] {
  return SCHEMA_FIELDS[modelName] || [];
}
