-- CreateTable
CREATE TABLE "DungeonAchievement" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "runId" TEXT,
    "seasonId" TEXT,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DungeonAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DungeonAchievement_runId_idx" ON "DungeonAchievement"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "DungeonAchievement_guildId_memberId_key_key" ON "DungeonAchievement"("guildId", "memberId", "key");

-- AddForeignKey
ALTER TABLE "DungeonAchievement" ADD CONSTRAINT "DungeonAchievement_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DungeonAchievement" ADD CONSTRAINT "DungeonAchievement_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DungeonAchievement" ADD CONSTRAINT "DungeonAchievement_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DungeonRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DungeonAchievement" ADD CONSTRAINT "DungeonAchievement_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "DungeonSeason"("id") ON DELETE SET NULL ON UPDATE CASCADE;

