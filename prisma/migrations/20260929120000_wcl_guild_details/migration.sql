-- Warcraft Logs: the guild whose reports are found automatically, and a private per-report check (consumables, deaths).
ALTER TABLE "GuildSettings" ADD COLUMN "wclGuildId" INTEGER;
ALTER TABLE "GuildSettings" ADD COLUMN "wclBaseUrl" TEXT;
ALTER TABLE "WarcraftLogsReport" ADD COLUMN "details" JSONB;
