-- AlterTable
ALTER TABLE "GuildSettings" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'America/Toronto',
ADD COLUMN     "welcomeDelivery" TEXT NOT NULL DEFAULT 'CHANNEL',
ADD COLUMN     "welcomeRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "welcomeRolePrompt" TEXT;
