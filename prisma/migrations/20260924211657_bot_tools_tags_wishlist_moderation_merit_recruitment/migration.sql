-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'MODERATION_WARN';
ALTER TYPE "AuditAction" ADD VALUE 'MODERATION_TIMEOUT';
ALTER TYPE "AuditAction" ADD VALUE 'MODERATION_KICK';
ALTER TYPE "AuditAction" ADD VALUE 'MODERATION_BAN';

-- AlterTable
ALTER TABLE "GuildSettings" ADD COLUMN     "logChannelId" TEXT,
ADD COLUMN     "meritEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recruitmentChannelId" TEXT,
ADD COLUMN     "recruitmentIntervalHours" INTEGER,
ADD COLUMN     "recruitmentLastPostedAt" TIMESTAMP(3),
ADD COLUMN     "recruitmentMessage" TEXT;

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistEntry" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_guildId_name_key" ON "Tag"("guildId", "name");

-- CreateIndex
CREATE INDEX "WishlistEntry_itemKey_idx" ON "WishlistEntry"("itemKey");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistEntry_characterId_itemKey_key" ON "WishlistEntry"("characterId", "itemKey");

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistEntry" ADD CONSTRAINT "WishlistEntry_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
