-- CreateEnum
CREATE TYPE "CraftRequestStatus" AS ENUM ('OPEN', 'CLAIMED', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "CraftRequest" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "crafterId" TEXT,
    "item" TEXT NOT NULL,
    "profession" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "materialsProvided" BOOLEAN NOT NULL DEFAULT false,
    "status" "CraftRequestStatus" NOT NULL DEFAULT 'OPEN',
    "claimedAt" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CraftRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CraftRequest_guildId_status_createdAt_idx" ON "CraftRequest"("guildId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CraftRequest_requesterId_idx" ON "CraftRequest"("requesterId");

-- CreateIndex
CREATE INDEX "CraftRequest_crafterId_idx" ON "CraftRequest"("crafterId");

-- AddForeignKey
ALTER TABLE "CraftRequest" ADD CONSTRAINT "CraftRequest_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CraftRequest" ADD CONSTRAINT "CraftRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CraftRequest" ADD CONSTRAINT "CraftRequest_crafterId_fkey" FOREIGN KEY ("crafterId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
