-- AlterTable
ALTER TABLE "GuildSettings" ADD COLUMN     "weeklyReportEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "weeklyReportLastAt" TIMESTAMP(3);
