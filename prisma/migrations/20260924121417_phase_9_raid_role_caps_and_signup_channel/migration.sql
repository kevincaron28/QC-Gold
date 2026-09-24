-- CreateEnum
CREATE TYPE "RaidRole" AS ENUM ('TANK', 'HEALER', 'DPS');

-- AlterTable
ALTER TABLE "GuildSettings" ADD COLUMN     "raidSignupChannelId" TEXT;

-- AlterTable
ALTER TABLE "Raid" ADD COLUMN     "dpsLimit" INTEGER,
ADD COLUMN     "healerLimit" INTEGER,
ADD COLUMN     "signupChannelId" TEXT,
ADD COLUMN     "signupMessageId" TEXT,
ADD COLUMN     "tankLimit" INTEGER;

-- AlterTable
ALTER TABLE "RaidSignup" ADD COLUMN     "role" "RaidRole" NOT NULL DEFAULT 'DPS';
