-- AlterTable
ALTER TABLE "GuildSettings" ADD COLUMN     "dungeonChannelId" TEXT,
ADD COLUMN     "dungeonConfig" JSONB;

-- CreateTable
CREATE TABLE "DungeonSeason" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DungeonSeason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DungeonRun" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "runRef" TEXT NOT NULL,
    "instanceId" INTEGER NOT NULL,
    "dungeonName" TEXT NOT NULL,
    "difficultyId" INTEGER NOT NULL DEFAULT 0,
    "state" TEXT NOT NULL,
    "valid" BOOLEAN NOT NULL DEFAULT true,
    "invalidReason" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationSec" INTEGER,
    "completedBy" TEXT,
    "recorder" TEXT,
    "reporters" INTEGER NOT NULL DEFAULT 1,
    "protocolVersion" INTEGER NOT NULL,
    "addonVersion" TEXT,
    "seasonId" TEXT,
    "importId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DungeonRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DungeonRunPlayer" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "character" TEXT NOT NULL,
    "memberId" TEXT,
    "class" TEXT,
    "role" TEXT,
    "deaths" INTEGER,
    "presentSec" INTEGER NOT NULL DEFAULT 0,
    "inGuild" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DungeonRunPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DungeonPointTransaction" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "runId" TEXT,
    "seasonId" TEXT,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DungeonPointTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DungeonSeason_guildId_status_idx" ON "DungeonSeason"("guildId", "status");

-- CreateIndex
CREATE INDEX "DungeonRun_guildId_instanceId_valid_idx" ON "DungeonRun"("guildId", "instanceId", "valid");

-- CreateIndex
CREATE INDEX "DungeonRun_guildId_endedAt_idx" ON "DungeonRun"("guildId", "endedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DungeonRun_guildId_runRef_key" ON "DungeonRun"("guildId", "runRef");

-- CreateIndex
CREATE INDEX "DungeonRunPlayer_runId_idx" ON "DungeonRunPlayer"("runId");

-- CreateIndex
CREATE INDEX "DungeonRunPlayer_memberId_idx" ON "DungeonRunPlayer"("memberId");

-- CreateIndex
CREATE INDEX "DungeonPointTransaction_guildId_createdAt_idx" ON "DungeonPointTransaction"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "DungeonPointTransaction_memberId_createdAt_idx" ON "DungeonPointTransaction"("memberId", "createdAt");

-- CreateIndex
CREATE INDEX "DungeonPointTransaction_runId_idx" ON "DungeonPointTransaction"("runId");

-- AddForeignKey
ALTER TABLE "DungeonSeason" ADD CONSTRAINT "DungeonSeason_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DungeonRun" ADD CONSTRAINT "DungeonRun_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DungeonRun" ADD CONSTRAINT "DungeonRun_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "DungeonSeason"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DungeonRunPlayer" ADD CONSTRAINT "DungeonRunPlayer_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DungeonRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DungeonRunPlayer" ADD CONSTRAINT "DungeonRunPlayer_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DungeonPointTransaction" ADD CONSTRAINT "DungeonPointTransaction_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DungeonPointTransaction" ADD CONSTRAINT "DungeonPointTransaction_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DungeonPointTransaction" ADD CONSTRAINT "DungeonPointTransaction_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DungeonRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DungeonPointTransaction" ADD CONSTRAINT "DungeonPointTransaction_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "DungeonSeason"("id") ON DELETE SET NULL ON UPDATE CASCADE;
