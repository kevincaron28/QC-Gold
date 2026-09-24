-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TRIAL', 'LEFT');

-- CreateEnum
CREATE TYPE "DkpTransactionType" AS ENUM ('AWARD', 'DEDUCTION', 'ADJUSTMENT', 'REFUND', 'DECAY', 'IMPORT');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('MEMBER_CREATED', 'MEMBER_UPDATED', 'DKP_TRANSACTION_CREATED', 'DKP_TRANSACTION_REVERSED', 'IMPORT_PREVIEWED', 'IMPORT_APPLIED', 'CONFIG_UPDATED');

-- CreateEnum
CREATE TYPE "RaidStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RaidSignupStatus" AS ENUM ('SIGNED_UP', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RaidAttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'ABSENT');

-- CreateEnum
CREATE TYPE "RaidBossStatus" AS ENUM ('PENDING', 'KILLED');

-- CreateEnum
CREATE TYPE "AuctionStatus" AS ENUM ('ACTIVE', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'TRIAL');

-- CreateTable
CREATE TABLE "Guild" (
    "id" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "realm" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "spec" TEXT,
    "level" INTEGER,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessionSkill" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "profession" TEXT NOT NULL,
    "skillLevel" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DkpTransaction" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "DkpTransactionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "sourceRef" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DkpTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auction" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "minimumBid" INTEGER NOT NULL,
    "bidIncrement" INTEGER NOT NULL,
    "status" "AuctionStatus" NOT NULL DEFAULT 'ACTIVE',
    "closesAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Auction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionBid" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuctionBid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LootAward" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LootAward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "character" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "spec" TEXT NOT NULL,
    "experience" TEXT NOT NULL,
    "availability" TEXT NOT NULL,
    "notes" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AddonImport" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AddonImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildSettings" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "attendanceDkp" INTEGER NOT NULL DEFAULT 10,
    "lateAttendanceDkp" INTEGER NOT NULL DEFAULT 5,
    "bossKillDkp" INTEGER NOT NULL DEFAULT 5,
    "minimumBid" INTEGER NOT NULL DEFAULT 10,
    "bidIncrement" INTEGER NOT NULL DEFAULT 5,
    "auctionDurationSec" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Raid" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "RaidStatus" NOT NULL DEFAULT 'PLANNED',
    "createdBy" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Raid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaidSignup" (
    "id" TEXT NOT NULL,
    "raidId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" "RaidSignupStatus" NOT NULL DEFAULT 'SIGNED_UP',
    "signedUpAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "RaidSignup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaidAttendance" (
    "id" TEXT NOT NULL,
    "raidId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" "RaidAttendanceStatus" NOT NULL,
    "recordedBy" TEXT NOT NULL,
    "notes" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaidAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaidBoss" (
    "id" TEXT NOT NULL,
    "raidId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "RaidBossStatus" NOT NULL DEFAULT 'PENDING',
    "killedAt" TIMESTAMP(3),

    CONSTRAINT "RaidBoss_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Guild_discordId_key" ON "Guild"("discordId");

-- CreateIndex
CREATE INDEX "Member_guildId_status_idx" ON "Member"("guildId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Member_guildId_discordUserId_key" ON "Member"("guildId", "discordUserId");

-- CreateIndex
CREATE INDEX "Character_memberId_isMain_idx" ON "Character"("memberId", "isMain");

-- CreateIndex
CREATE UNIQUE INDEX "Character_realm_name_key" ON "Character"("realm", "name");

-- CreateIndex
CREATE INDEX "ProfessionSkill_profession_skillLevel_idx" ON "ProfessionSkill"("profession", "skillLevel");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionSkill_characterId_profession_key" ON "ProfessionSkill"("characterId", "profession");

-- CreateIndex
CREATE INDEX "DkpTransaction_memberId_createdAt_idx" ON "DkpTransaction"("memberId", "createdAt");

-- CreateIndex
CREATE INDEX "DkpTransaction_guildId_createdAt_idx" ON "DkpTransaction"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "Auction_guildId_status_idx" ON "Auction"("guildId", "status");

-- CreateIndex
CREATE INDEX "Auction_guildId_closesAt_idx" ON "Auction"("guildId", "closesAt");

-- CreateIndex
CREATE INDEX "AuctionBid_auctionId_amount_idx" ON "AuctionBid"("auctionId", "amount");

-- CreateIndex
CREATE UNIQUE INDEX "AuctionBid_auctionId_memberId_key" ON "AuctionBid"("auctionId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "LootAward_auctionId_key" ON "LootAward"("auctionId");

-- CreateIndex
CREATE INDEX "LootAward_guildId_awardedAt_idx" ON "LootAward"("guildId", "awardedAt");

-- CreateIndex
CREATE INDEX "LootAward_memberId_awardedAt_idx" ON "LootAward"("memberId", "awardedAt");

-- CreateIndex
CREATE INDEX "Application_guildId_status_createdAt_idx" ON "Application"("guildId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Application_memberId_createdAt_idx" ON "Application"("memberId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_guildId_createdAt_idx" ON "AuditLog"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "AddonImport_guildId_createdAt_idx" ON "AddonImport"("guildId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GuildSettings_guildId_key" ON "GuildSettings"("guildId");

-- CreateIndex
CREATE INDEX "Raid_guildId_scheduledAt_idx" ON "Raid"("guildId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Raid_guildId_status_idx" ON "Raid"("guildId", "status");

-- CreateIndex
CREATE INDEX "RaidSignup_raidId_status_idx" ON "RaidSignup"("raidId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RaidSignup_raidId_memberId_key" ON "RaidSignup"("raidId", "memberId");

-- CreateIndex
CREATE INDEX "RaidAttendance_raidId_status_idx" ON "RaidAttendance"("raidId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RaidAttendance_raidId_memberId_key" ON "RaidAttendance"("raidId", "memberId");

-- CreateIndex
CREATE INDEX "RaidBoss_raidId_sortOrder_idx" ON "RaidBoss"("raidId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "RaidBoss_raidId_name_key" ON "RaidBoss"("raidId", "name");

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionSkill" ADD CONSTRAINT "ProfessionSkill_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DkpTransaction" ADD CONSTRAINT "DkpTransaction_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DkpTransaction" ADD CONSTRAINT "DkpTransaction_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionBid" ADD CONSTRAINT "AuctionBid_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionBid" ADD CONSTRAINT "AuctionBid_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LootAward" ADD CONSTRAINT "LootAward_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LootAward" ADD CONSTRAINT "LootAward_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LootAward" ADD CONSTRAINT "LootAward_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddonImport" ADD CONSTRAINT "AddonImport_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildSettings" ADD CONSTRAINT "GuildSettings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Raid" ADD CONSTRAINT "Raid_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidSignup" ADD CONSTRAINT "RaidSignup_raidId_fkey" FOREIGN KEY ("raidId") REFERENCES "Raid"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidSignup" ADD CONSTRAINT "RaidSignup_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidAttendance" ADD CONSTRAINT "RaidAttendance_raidId_fkey" FOREIGN KEY ("raidId") REFERENCES "Raid"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidAttendance" ADD CONSTRAINT "RaidAttendance_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidBoss" ADD CONSTRAINT "RaidBoss_raidId_fkey" FOREIGN KEY ("raidId") REFERENCES "Raid"("id") ON DELETE CASCADE ON UPDATE CASCADE;

