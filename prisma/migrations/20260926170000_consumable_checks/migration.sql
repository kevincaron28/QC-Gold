-- CreateTable
CREATE TABLE "ConsumableCheck" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "character" TEXT NOT NULL,
    "realm" TEXT NOT NULL,
    "flask" TEXT,
    "elixirs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "food" TEXT,
    "weapon" TEXT,
    "scannedAt" TIMESTAMP(3) NOT NULL,
    "scannedBy" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "ConsumableCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsumableCheck_guildId_scannedAt_idx" ON "ConsumableCheck"("guildId", "scannedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumableCheck_guildId_character_realm_key" ON "ConsumableCheck"("guildId", "character", "realm");

-- AddForeignKey
ALTER TABLE "ConsumableCheck" ADD CONSTRAINT "ConsumableCheck_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
