-- Loot systems per core: soft reserves per player, and set item prices for EPGP priority loot.
ALTER TABLE "RaidCore" ADD COLUMN "reservesPerPlayer" INTEGER;

CREATE TABLE "CoreItemValue" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "coreId" TEXT NOT NULL DEFAULT '',
    "itemKey" TEXT NOT NULL,
    "itemId" INTEGER,
    "itemName" TEXT NOT NULL,
    "gp" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoreItemValue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CoreItemValue_guildId_coreId_itemKey_key" ON "CoreItemValue"("guildId", "coreId", "itemKey");
CREATE INDEX "CoreItemValue_guildId_coreId_idx" ON "CoreItemValue"("guildId", "coreId");

ALTER TABLE "CoreItemValue" ADD CONSTRAINT "CoreItemValue_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
