-- Recipes and profession cooldowns, from the addon's profession scan.
ALTER TABLE "Member" ADD COLUMN "cooldownPings" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "RecipeKnown" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "character" TEXT NOT NULL,
    "realm" TEXT NOT NULL,
    "profession" TEXT NOT NULL,
    "itemKey" INTEGER NOT NULL,
    "itemName" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeKnown_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProfessionCooldown" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "character" TEXT NOT NULL,
    "realm" TEXT NOT NULL,
    "profession" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "readyAt" TIMESTAMP(3) NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "ProfessionCooldown_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecipeKnown_guildId_character_realm_itemKey_key" ON "RecipeKnown"("guildId", "character", "realm", "itemKey");
CREATE INDEX "RecipeKnown_guildId_itemKey_idx" ON "RecipeKnown"("guildId", "itemKey");
CREATE INDEX "RecipeKnown_guildId_character_realm_profession_idx" ON "RecipeKnown"("guildId", "character", "realm", "profession");
CREATE UNIQUE INDEX "ProfessionCooldown_guildId_character_realm_profession_name_key" ON "ProfessionCooldown"("guildId", "character", "realm", "profession", "name");
CREATE INDEX "ProfessionCooldown_guildId_readyAt_idx" ON "ProfessionCooldown"("guildId", "readyAt");

ALTER TABLE "RecipeKnown" ADD CONSTRAINT "RecipeKnown_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfessionCooldown" ADD CONSTRAINT "ProfessionCooldown_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
