-- CreateEnum
CREATE TYPE "BankRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'FULFILLED', 'DENIED', 'CANCELLED');

-- CreateTable
CREATE TABLE "BankRequest" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "status" "BankRequestStatus" NOT NULL DEFAULT 'PENDING',
    "handledBy" TEXT,
    "handledAt" TIMESTAMP(3),
    "reply" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankRequest_guildId_status_createdAt_idx" ON "BankRequest"("guildId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "BankRequest_memberId_createdAt_idx" ON "BankRequest"("memberId", "createdAt");

-- AddForeignKey
ALTER TABLE "BankRequest" ADD CONSTRAINT "BankRequest_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankRequest" ADD CONSTRAINT "BankRequest_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
