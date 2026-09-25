-- AlterTable
ALTER TABLE "GuildSettings" ADD COLUMN     "raidLogChannelId" TEXT,
ADD COLUMN     "dungeonLeaderboardChannelId" TEXT,
ADD COLUMN     "dungeonLeaderboardMessageId" TEXT,
ADD COLUMN     "dungeonSignupChannelId" TEXT;
