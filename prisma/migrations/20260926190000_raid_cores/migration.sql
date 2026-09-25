-- AlterTable
ALTER TABLE "GuildSettings" ADD COLUMN     "coreChannelId" TEXT;

-- AlterTable
ALTER TABLE "Raid" ADD COLUMN     "coreId" TEXT;

-- CreateTable
CREATE TABLE "RaidCore" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rosterMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaidCore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaidCoreMember" (
    "id" TEXT NOT NULL,
    "coreId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "role" "RaidRole" NOT NULL DEFAULT 'DPS',
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaidCoreMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RaidCore_guildId_name_key" ON "RaidCore"("guildId", "name");

-- CreateIndex
CREATE INDEX "RaidCoreMember_memberId_idx" ON "RaidCoreMember"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "RaidCoreMember_coreId_memberId_key" ON "RaidCoreMember"("coreId", "memberId");

-- AddForeignKey
ALTER TABLE "Raid" ADD CONSTRAINT "Raid_coreId_fkey" FOREIGN KEY ("coreId") REFERENCES "RaidCore"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidCore" ADD CONSTRAINT "RaidCore_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidCoreMember" ADD CONSTRAINT "RaidCoreMember_coreId_fkey" FOREIGN KEY ("coreId") REFERENCES "RaidCore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidCoreMember" ADD CONSTRAINT "RaidCoreMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
