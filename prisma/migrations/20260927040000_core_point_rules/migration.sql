-- AlterTable
ALTER TABLE "RaidCore" ADD COLUMN     "baseGp" INTEGER,
ADD COLUMN     "decayPercent" DOUBLE PRECISION,
ADD COLUMN     "lootMode" TEXT,
ADD COLUMN     "separatePool" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "EpgpTransaction" ADD COLUMN     "coreId" TEXT;

-- CreateIndex
CREATE INDEX "EpgpTransaction_coreId_idx" ON "EpgpTransaction"("coreId");
