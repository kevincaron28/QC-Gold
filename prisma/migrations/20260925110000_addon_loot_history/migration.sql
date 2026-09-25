-- AlterTable
ALTER TABLE "LootAward" ADD COLUMN     "sourceRef" TEXT,
ALTER COLUMN "auctionId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "LootAward_sourceRef_key" ON "LootAward"("sourceRef");

