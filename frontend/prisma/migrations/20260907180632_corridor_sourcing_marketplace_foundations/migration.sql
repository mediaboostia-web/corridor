-- AlterTable
ALTER TABLE "User" ADD COLUMN     "marketplaceRole" TEXT,
ADD COLUMN     "marketplaceRoleSetAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AgentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "actionZone" TEXT NOT NULL,
    "phone" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "idFrontUploadId" TEXT,
    "idBackUploadId" TEXT,
    "selfieUploadId" TEXT,
    "verificationSubmittedAt" TIMESTAMP(3),
    "verificationReviewedAt" TIMESTAMP(3),
    "verificationReviewerId" TEXT,
    "verificationRejectionReason" TEXT,
    "missionCount" INTEGER NOT NULL DEFAULT 0,
    "avgRating" DOUBLE PRECISION,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "publicSlug" TEXT NOT NULL,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesalerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUploadId" TEXT,
    "coverUploadId" TEXT,
    "description" TEXT,
    "locationCity" TEXT NOT NULL DEFAULT 'Cotonou',
    "locationDetail" TEXT,
    "hours" TEXT,
    "whatsappLink" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WholesalerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "wholesalerProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priceAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "minQuantity" INTEGER NOT NULL DEFAULT 1,
    "availability" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "moderatedByUserId" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMedia" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "fileUploadId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourcingRequest" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "productId" TEXT,
    "tiktokLink" TEXT,
    "facebookLink" TEXT,
    "budgetAmount" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "quantity" INTEGER,
    "deliveryCountry" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "selectedCandidatureId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourcingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestMedia" (
    "id" TEXT NOT NULL,
    "sourcingRequestId" TEXT NOT NULL,
    "fileUploadId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidature" (
    "id" TEXT NOT NULL,
    "sourcingRequestId" TEXT NOT NULL,
    "agentProfileId" TEXT NOT NULL,
    "proposedCommissionAmount" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL,
    "sourcingRequestId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "agentProfileId" TEXT NOT NULL,
    "wholesalerProfileId" TEXT,
    "agreedCommissionAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "status" TEXT NOT NULL DEFAULT 'RECU',
    "deliveryConfirmedAt" TIMESTAMP(3),
    "autoClosedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionStatusEvent" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionStatusEventMedia" (
    "id" TEXT NOT NULL,
    "missionStatusEventId" TEXT NOT NULL,
    "fileUploadId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionStatusEventMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subjectType" TEXT,
    "subjectId" TEXT,
    "participantAId" TEXT NOT NULL,
    "participantBId" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageMedia" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fileUploadId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveAnnouncement" (
    "id" TEXT NOT NULL,
    "wholesalerProfileId" TEXT NOT NULL,
    "title" TEXT,
    "externalLink" TEXT NOT NULL,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "agentProfileId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileType" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INACTIVE',
    "currentPeriodEnd" TIMESTAMP(3),
    "graceEndsAt" TIMESTAMP(3),
    "lastOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentProfile_userId_key" ON "AgentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentProfile_publicSlug_key" ON "AgentProfile"("publicSlug");

-- CreateIndex
CREATE INDEX "AgentProfile_verificationStatus_idx" ON "AgentProfile"("verificationStatus");

-- CreateIndex
CREATE INDEX "AgentProfile_publicSlug_idx" ON "AgentProfile"("publicSlug");

-- CreateIndex
CREATE UNIQUE INDEX "WholesalerProfile_userId_key" ON "WholesalerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WholesalerProfile_slug_key" ON "WholesalerProfile"("slug");

-- CreateIndex
CREATE INDEX "WholesalerProfile_status_idx" ON "WholesalerProfile"("status");

-- CreateIndex
CREATE INDEX "WholesalerProfile_slug_idx" ON "WholesalerProfile"("slug");

-- CreateIndex
CREATE INDEX "Product_wholesalerProfileId_status_idx" ON "Product"("wholesalerProfileId", "status");

-- CreateIndex
CREATE INDEX "Product_category_status_idx" ON "Product"("category", "status");

-- CreateIndex
CREATE INDEX "ProductMedia_productId_idx" ON "ProductMedia"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "SourcingRequest_selectedCandidatureId_key" ON "SourcingRequest"("selectedCandidatureId");

-- CreateIndex
CREATE INDEX "SourcingRequest_status_createdAt_idx" ON "SourcingRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SourcingRequest_buyerId_status_idx" ON "SourcingRequest"("buyerId", "status");

-- CreateIndex
CREATE INDEX "RequestMedia_sourcingRequestId_idx" ON "RequestMedia"("sourcingRequestId");

-- CreateIndex
CREATE INDEX "Candidature_agentProfileId_status_idx" ON "Candidature"("agentProfileId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Candidature_sourcingRequestId_agentProfileId_key" ON "Candidature"("sourcingRequestId", "agentProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "Mission_sourcingRequestId_key" ON "Mission"("sourcingRequestId");

-- CreateIndex
CREATE INDEX "Mission_buyerId_status_idx" ON "Mission"("buyerId", "status");

-- CreateIndex
CREATE INDEX "Mission_agentProfileId_status_idx" ON "Mission"("agentProfileId", "status");

-- CreateIndex
CREATE INDEX "Mission_wholesalerProfileId_status_idx" ON "Mission"("wholesalerProfileId", "status");

-- CreateIndex
CREATE INDEX "MissionStatusEvent_missionId_createdAt_idx" ON "MissionStatusEvent"("missionId", "createdAt");

-- CreateIndex
CREATE INDEX "MissionStatusEventMedia_missionStatusEventId_idx" ON "MissionStatusEventMedia"("missionStatusEventId");

-- CreateIndex
CREATE INDEX "Conversation_participantAId_lastMessageAt_idx" ON "Conversation"("participantAId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_participantBId_lastMessageAt_idx" ON "Conversation"("participantBId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_participantAId_participantBId_subjectType_subj_key" ON "Conversation"("participantAId", "participantBId", "subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageMedia_messageId_idx" ON "MessageMedia"("messageId");

-- CreateIndex
CREATE INDEX "LiveAnnouncement_wholesalerProfileId_scheduledStart_idx" ON "LiveAnnouncement"("wholesalerProfileId", "scheduledStart");

-- CreateIndex
CREATE INDEX "LiveAnnouncement_status_scheduledStart_idx" ON "LiveAnnouncement"("status", "scheduledStart");

-- CreateIndex
CREATE UNIQUE INDEX "Review_missionId_key" ON "Review"("missionId");

-- CreateIndex
CREATE INDEX "Review_agentProfileId_createdAt_idx" ON "Review"("agentProfileId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProSubscription_userId_key" ON "ProSubscription"("userId");

-- CreateIndex
CREATE INDEX "ProSubscription_status_currentPeriodEnd_idx" ON "ProSubscription"("status", "currentPeriodEnd");

-- CreateIndex
CREATE INDEX "User_marketplaceRole_idx" ON "User"("marketplaceRole");

-- AddForeignKey
ALTER TABLE "AgentProfile" ADD CONSTRAINT "AgentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesalerProfile" ADD CONSTRAINT "WholesalerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_wholesalerProfileId_fkey" FOREIGN KEY ("wholesalerProfileId") REFERENCES "WholesalerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourcingRequest" ADD CONSTRAINT "SourcingRequest_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourcingRequest" ADD CONSTRAINT "SourcingRequest_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestMedia" ADD CONSTRAINT "RequestMedia_sourcingRequestId_fkey" FOREIGN KEY ("sourcingRequestId") REFERENCES "SourcingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidature" ADD CONSTRAINT "Candidature_sourcingRequestId_fkey" FOREIGN KEY ("sourcingRequestId") REFERENCES "SourcingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidature" ADD CONSTRAINT "Candidature_agentProfileId_fkey" FOREIGN KEY ("agentProfileId") REFERENCES "AgentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_sourcingRequestId_fkey" FOREIGN KEY ("sourcingRequestId") REFERENCES "SourcingRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_agentProfileId_fkey" FOREIGN KEY ("agentProfileId") REFERENCES "AgentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_wholesalerProfileId_fkey" FOREIGN KEY ("wholesalerProfileId") REFERENCES "WholesalerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionStatusEvent" ADD CONSTRAINT "MissionStatusEvent_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionStatusEventMedia" ADD CONSTRAINT "MissionStatusEventMedia_missionStatusEventId_fkey" FOREIGN KEY ("missionStatusEventId") REFERENCES "MissionStatusEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageMedia" ADD CONSTRAINT "MessageMedia_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveAnnouncement" ADD CONSTRAINT "LiveAnnouncement_wholesalerProfileId_fkey" FOREIGN KEY ("wholesalerProfileId") REFERENCES "WholesalerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_agentProfileId_fkey" FOREIGN KEY ("agentProfileId") REFERENCES "AgentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProSubscription" ADD CONSTRAINT "ProSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
