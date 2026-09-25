-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RaidSignupStatus" ADD VALUE 'MAYBE';
ALTER TYPE "RaidSignupStatus" ADD VALUE 'WAITLISTED';

-- AlterTable
ALTER TABLE "Auction" ADD COLUMN     "bossName" TEXT,
ADD COLUMN     "raidId" TEXT;

-- AlterTable
ALTER TABLE "Character" ADD COLUMN     "lastSeenAt" TIMESTAMP(3),
ADD COLUMN     "race" TEXT;

-- AlterTable
ALTER TABLE "GuildSettings" ADD COLUMN     "baseGp" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "epCompletionBonus" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "notifyChannelId" TEXT,
ADD COLUMN     "raidReminderMinutes" INTEGER NOT NULL DEFAULT 60;

-- AlterTable
ALTER TABLE "LootAward" ADD COLUMN     "awardedBy" TEXT,
ADD COLUMN     "bossName" TEXT,
ADD COLUMN     "epBefore" INTEGER,
ADD COLUMN     "gpBefore" INTEGER,
ADD COLUMN     "raidId" TEXT;

-- AlterTable
ALTER TABLE "Raid" ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RaidNote" (
    "id" TEXT NOT NULL,
    "raidId" TEXT NOT NULL,
    "bossName" TEXT,
    "body" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaidNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RaidNote_raidId_createdAt_idx" ON "RaidNote"("raidId", "createdAt");

-- AddForeignKey
ALTER TABLE "RaidNote" ADD CONSTRAINT "RaidNote_raidId_fkey" FOREIGN KEY ("raidId") REFERENCES "Raid"("id") ON DELETE CASCADE ON UPDATE CASCADE;
