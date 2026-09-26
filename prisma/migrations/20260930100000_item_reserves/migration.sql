-- Soft reserves kept in the addon, copied here from the companion's export.
CREATE TABLE "ReserveList" (
    "guildId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "perPlayer" INTEGER NOT NULL DEFAULT 1,
    "open" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "keeper" TEXT NOT NULL DEFAULT '',
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReserveList_pkey" PRIMARY KEY ("guildId")
);

CREATE TABLE "ItemReserve" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "character" TEXT NOT NULL,
    "realm" TEXT NOT NULL,
    "itemId" INTEGER NOT NULL,
    "itemName" TEXT NOT NULL,

    CONSTRAINT "ItemReserve_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ItemReserve_guildId_itemId_idx" ON "ItemReserve"("guildId", "itemId");
CREATE UNIQUE INDEX "ItemReserve_guildId_character_realm_itemId_key" ON "ItemReserve"("guildId", "character", "realm", "itemId");

ALTER TABLE "ReserveList" ADD CONSTRAINT "ReserveList_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItemReserve" ADD CONSTRAINT "ItemReserve_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
