-- AlterTable
ALTER TABLE "GuildSettings" ADD COLUMN     "applicantRoleId" TEXT,
ADD COLUMN     "farewellChannelId" TEXT,
ADD COLUMN     "farewellMessageTemplate" TEXT,
ADD COLUMN     "memberRoleId" TEXT,
ADD COLUMN     "welcomeChannelId" TEXT,
ADD COLUMN     "welcomeMessageTemplate" TEXT;
