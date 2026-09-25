-- AlterTable
ALTER TABLE "GuildSettings" ADD COLUMN     "lootChannelId" TEXT,
ADD COLUMN     "craftChannelId" TEXT;

-- CreateTable
CREATE TABLE "WarcraftLogsReport" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "zone" TEXT,
    "owner" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "summary" JSONB NOT NULL,
    "raidId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarcraftLogsReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WarcraftLogsReport_guildId_startedAt_idx" ON "WarcraftLogsReport"("guildId", "startedAt");

-- CreateIndex
CREATE INDEX "WarcraftLogsReport_raidId_idx" ON "WarcraftLogsReport"("raidId");

-- CreateIndex
CREATE UNIQUE INDEX "WarcraftLogsReport_guildId_code_key" ON "WarcraftLogsReport"("guildId", "code");

-- AddForeignKey
ALTER TABLE "WarcraftLogsReport" ADD CONSTRAINT "WarcraftLogsReport_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
