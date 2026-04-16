-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "planExpiresAt" TIMESTAMP(3),
    "rewardDays" INTEGER NOT NULL DEFAULT 0,
    "postcardCount" INTEGER NOT NULL DEFAULT 0,
    "lastActiveAt" TIMESTAMP(3),
    "invitationCode" TEXT,
    "invitedBy" TEXT,
    "referralBonusQuota" INTEGER NOT NULL DEFAULT 0,
    "referrerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "bonusQuota" INTEGER NOT NULL DEFAULT 0,
    "freeResetAt" TIMESTAMP(3),
    "freeUsedCount" INTEGER NOT NULL DEFAULT 0,
    "arrivalsTotalCount" INTEGER NOT NULL DEFAULT 0,
    "arrivalsLastSearchedAt" TIMESTAMP(3),
    "arrivalsFolder" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_logs" (
    "id" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "path" TEXT NOT NULL,
    "referer" TEXT,
    "country" TEXT,
    "city" TEXT,
    "userId" TEXT,
    "sessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_codes" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_materials" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "contentStruct" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "tags" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "user_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "referredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "freeRewardGiven" BOOLEAN NOT NULL DEFAULT false,
    "paidRewardGiven" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quota_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quota_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "planType" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "proofUrl" TEXT,
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedbacks" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "content" TEXT NOT NULL,
    "subject" TEXT,
    "fromEmail" TEXT,
    "emailMessageId" TEXT,
    "rawEmailData" TEXT,
    "sentiment" TEXT,
    "category" TEXT,
    "priority" TEXT,
    "rewardSuggestion" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rewardAmount" INTEGER NOT NULL DEFAULT 0,
    "rewardDays" INTEGER NOT NULL DEFAULT 0,
    "processedAt" TIMESTAMP(3),
    "processedBy" TEXT,
    "notes" TEXT,
    "githubIssueUrl" TEXT,
    "githubIssueNumber" INTEGER,
    "issuePushedAt" TIMESTAMP(3),
    "workbuddyEvaluatingAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rating" INTEGER,
    "rewardGrantedAt" TIMESTAMP(3),
    "rewardType" TEXT,
    "source" TEXT NOT NULL DEFAULT 'email',
    "appVersion" TEXT,

    CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_contents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentBody" TEXT NOT NULL,
    "contentTitle" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'full_letter',
    "isHandwritten" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT NOT NULL DEFAULT 'zh',
    "postcardId" TEXT NOT NULL,
    "tone" TEXT NOT NULL DEFAULT 'friendly',
    "usedTokens" INTEGER NOT NULL DEFAULT 0,
    "contentZh" TEXT,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "generated_contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "postcards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postcardId" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientAddress" TEXT NOT NULL,
    "recipientCountry" TEXT NOT NULL,
    "recipientCity" TEXT,
    "recipientAge" INTEGER,
    "recipientGender" TEXT,
    "recipientInterests" TEXT,
    "recipientBio" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sentDate" TIMESTAMP(3),
    "receivedDate" TIMESTAMP(3),
    "content" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "distance" INTEGER,

    CONSTRAINT "postcards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "received_cards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT,
    "postcardId" TEXT,
    "postcardIdConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "cardRarity" TEXT,
    "cardId" TEXT,
    "hasShared" BOOLEAN NOT NULL DEFAULT false,
    "imageUrl" TEXT,
    "ocrText" TEXT,
    "metadata" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "received_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_logs" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "targetEmail" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "imapHost" TEXT NOT NULL,
    "imapPort" INTEGER NOT NULL,
    "imapUser" TEXT NOT NULL,
    "imapPass" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "folderPath" TEXT,

    CONSTRAINT "email_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT NOT NULL,
    "category" TEXT,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "gachaPoolId" TEXT,
    "keywords" TEXT,
    "rarity" TEXT NOT NULL DEFAULT 'N',
    "weight" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "card_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pasted_emails" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postcardId" TEXT NOT NULL,
    "rawContent" TEXT NOT NULL,
    "parsedData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pasted_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emails" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "htmlContent" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gacha_pools" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ssrRate" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "srRate" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "rRate" DOUBLE PRECISION NOT NULL DEFAULT 0.40,
    "nRate" DOUBLE PRECISION NOT NULL DEFAULT 0.40,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gacha_pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_gacha_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT,
    "rarity" TEXT NOT NULL,
    "postcardId" TEXT,
    "obtainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiScore" INTEGER,
    "contentScore" INTEGER,
    "cultureScore" INTEGER,
    "languageScore" INTEGER,
    "storyScore" INTEGER,
    "summary" TEXT,
    "luckyLevel" TEXT,
    "luckyBonus" INTEGER,

    CONSTRAINT "user_gacha_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_feedbacks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'other',
    "rating" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "adminReply" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badges" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "quotaReward" INTEGER NOT NULL DEFAULT 0,
    "daysReward" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_badges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isNew" BOOLEAN NOT NULL DEFAULT true,
    "viewedAt" TIMESTAMP(3),

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "completionRate" INTEGER NOT NULL DEFAULT 0,
    "qualityScore" INTEGER NOT NULL DEFAULT 0,
    "categoryProgress" TEXT,
    "lastEvaluatedAt" TIMESTAMP(3),
    "totalMatches" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "postcrossing_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastSyncError" TEXT,
    "cookie" TEXT,
    "cookieExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "postcrossing_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "postcrossing_traveling" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postcardId" TEXT NOT NULL,
    "receiverUsername" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "sentDate" TIMESTAMP(3) NOT NULL,
    "distance" INTEGER NOT NULL,
    "arrivedFlag" INTEGER NOT NULL DEFAULT 0,
    "rawData" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "parsedAt" TIMESTAMP(3),
    "parsedData" TEXT,
    "profileFetchedAt" TIMESTAMP(3),
    "profileText" TEXT,
    "recipientAddress" TEXT,
    "recipientCity" TEXT,
    "recipientCountry" TEXT,
    "recipientName" TEXT,
    "recipientPostal" TEXT,

    CONSTRAINT "postcrossing_traveling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "postcrossing_sync_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "postcrossing_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arrival_replies" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postcardId" TEXT NOT NULL,
    "destinationCountry" TEXT NOT NULL,
    "destinationCity" TEXT,
    "recipientName" TEXT,
    "recipientEmail" TEXT,
    "travelDays" INTEGER,
    "distance" INTEGER,
    "message" TEXT,
    "arrivedAt" TIMESTAMP(3),
    "emailDate" TIMESTAMP(3),
    "emailMessageId" TEXT,
    "rawSubject" TEXT,
    "rawContent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'parsed',
    "parseError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "arrival_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "aboutMe" TEXT NOT NULL DEFAULT '',
    "aboutMeEn" TEXT NOT NULL DEFAULT '',
    "casualNotes" TEXT NOT NULL DEFAULT '',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_analyses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postcardId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "aiScore" DOUBLE PRECISION NOT NULL,
    "categories" TEXT NOT NULL,
    "primaryCategory" TEXT NOT NULL,
    "emotion" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "sender" TEXT,
    "country" TEXT,
    "arrivedAt" TIMESTAMP(3),
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cacheValidUntil" TIMESTAMP(3) NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_invitationCode_key" ON "users"("invitationCode");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE UNIQUE INDEX "user_materials_userId_category_key" ON "user_materials"("userId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_code_key" ON "referrals"("code");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_referrerId_referredId_key" ON "referrals"("referrerId", "referredId");

-- CreateIndex
CREATE INDEX "feedbacks_source_idx" ON "feedbacks"("source");

-- CreateIndex
CREATE UNIQUE INDEX "postcards_postcardId_key" ON "postcards"("postcardId");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- CreateIndex
CREATE INDEX "pasted_emails_userId_idx" ON "pasted_emails"("userId");

-- CreateIndex
CREATE INDEX "pasted_emails_postcardId_idx" ON "pasted_emails"("postcardId");

-- CreateIndex
CREATE UNIQUE INDEX "emails_messageId_key" ON "emails"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "emails_userId_messageId_key" ON "emails"("userId", "messageId");

-- CreateIndex
CREATE UNIQUE INDEX "user_gacha_logs_postcardId_key" ON "user_gacha_logs"("postcardId");

-- CreateIndex
CREATE INDEX "user_gacha_logs_userId_idx" ON "user_gacha_logs"("userId");

-- CreateIndex
CREATE INDEX "user_gacha_logs_userId_obtainedAt_idx" ON "user_gacha_logs"("userId", "obtainedAt");

-- CreateIndex
CREATE INDEX "user_gacha_logs_postcardId_idx" ON "user_gacha_logs"("postcardId");

-- CreateIndex
CREATE INDEX "user_feedbacks_userId_idx" ON "user_feedbacks"("userId");

-- CreateIndex
CREATE INDEX "user_feedbacks_userId_createdAt_idx" ON "user_feedbacks"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "user_feedbacks_status_idx" ON "user_feedbacks"("status");

-- CreateIndex
CREATE UNIQUE INDEX "badges_key_key" ON "badges"("key");

-- CreateIndex
CREATE INDEX "user_badges_userId_idx" ON "user_badges"("userId");

-- CreateIndex
CREATE INDEX "user_badges_userId_isNew_idx" ON "user_badges"("userId", "isNew");

-- CreateIndex
CREATE UNIQUE INDEX "user_badges_userId_badgeId_key" ON "user_badges"("userId", "badgeId");

-- CreateIndex
CREATE UNIQUE INDEX "material_progress_userId_key" ON "material_progress"("userId");

-- CreateIndex
CREATE INDEX "material_progress_userId_idx" ON "material_progress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "postcrossing_accounts_userId_key" ON "postcrossing_accounts"("userId");

-- CreateIndex
CREATE INDEX "postcrossing_accounts_userId_idx" ON "postcrossing_accounts"("userId");

-- CreateIndex
CREATE INDEX "postcrossing_accounts_isActive_idx" ON "postcrossing_accounts"("isActive");

-- CreateIndex
CREATE INDEX "postcrossing_traveling_userId_idx" ON "postcrossing_traveling"("userId");

-- CreateIndex
CREATE INDEX "postcrossing_traveling_userId_sentDate_idx" ON "postcrossing_traveling"("userId", "sentDate");

-- CreateIndex
CREATE INDEX "postcrossing_traveling_postcardId_idx" ON "postcrossing_traveling"("postcardId");

-- CreateIndex
CREATE INDEX "postcrossing_sync_logs_userId_idx" ON "postcrossing_sync_logs"("userId");

-- CreateIndex
CREATE INDEX "postcrossing_sync_logs_userId_createdAt_idx" ON "postcrossing_sync_logs"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "arrival_replies_postcardId_key" ON "arrival_replies"("postcardId");

-- CreateIndex
CREATE INDEX "arrival_replies_userId_idx" ON "arrival_replies"("userId");

-- CreateIndex
CREATE INDEX "arrival_replies_userId_arrivedAt_idx" ON "arrival_replies"("userId", "arrivedAt");

-- CreateIndex
CREATE INDEX "arrival_replies_destinationCountry_idx" ON "arrival_replies"("destinationCountry");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_userId_key" ON "user_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "message_analyses_postcardId_key" ON "message_analyses"("postcardId");

-- CreateIndex
CREATE INDEX "message_analyses_userId_primaryCategory_idx" ON "message_analyses"("userId", "primaryCategory");

-- CreateIndex
CREATE INDEX "message_analyses_userId_cacheValidUntil_idx" ON "message_analyses"("userId", "cacheValidUntil");

-- CreateIndex
CREATE INDEX "message_analyses_userId_analyzedAt_idx" ON "message_analyses"("userId", "analyzedAt");

-- CreateIndex
CREATE INDEX "message_analyses_aiScore_idx" ON "message_analyses"("aiScore");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_materials" ADD CONSTRAINT "user_materials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referredId_fkey" FOREIGN KEY ("referredId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_contents" ADD CONSTRAINT "generated_contents_postcardId_fkey" FOREIGN KEY ("postcardId") REFERENCES "postcards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_contents" ADD CONSTRAINT "generated_contents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_templates" ADD CONSTRAINT "card_templates_gachaPoolId_fkey" FOREIGN KEY ("gachaPoolId") REFERENCES "gacha_pools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pasted_emails" ADD CONSTRAINT "pasted_emails_postcardId_fkey" FOREIGN KEY ("postcardId") REFERENCES "postcards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_gacha_logs" ADD CONSTRAINT "user_gacha_logs_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "card_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_gacha_logs" ADD CONSTRAINT "user_gacha_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_feedbacks" ADD CONSTRAINT "user_feedbacks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "badges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
