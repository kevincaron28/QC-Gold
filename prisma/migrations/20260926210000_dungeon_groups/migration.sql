-- CreateEnum
CREATE TYPE "DungeonGroupStatus" AS ENUM ('OPEN', 'STARTED', 'CLOSED');

-- CreateTable
CREATE TABLE "DungeonGroup" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "leaderId" TEXT NOT NULL,
    "status" "DungeonGroupStatus" NOT NULL DEFAULT 'OPEN',
    "signupChannelId" TEXT,
    "signupMessageId" TEXT,
    "voiceChannelId" TEXT,
    "voiceEmptySince" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "DungeonGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DungeonGroupSignup" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "role" "RaidRole" NOT NULL DEFAULT 'DPS',
    "status" "RaidSignupStatus" NOT NULL DEFAULT 'SIGNED_UP',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DungeonGroupSignup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DungeonGroup_guildId_status_idx" ON "DungeonGroup"("guildId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DungeonGroupSignup_groupId_memberId_key" ON "DungeonGroupSignup"("groupId", "memberId");

-- AddForeignKey
ALTER TABLE "DungeonGroup" ADD CONSTRAINT "DungeonGroup_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DungeonGroupSignup" ADD CONSTRAINT "DungeonGroupSignup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "DungeonGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DungeonGroupSignup" ADD CONSTRAINT "DungeonGroupSignup_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
