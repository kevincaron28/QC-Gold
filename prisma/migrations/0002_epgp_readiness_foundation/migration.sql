-- EPGP is additive. Existing DkpTransaction rows remain available for history and compatibility.
CREATE TYPE "EpgpTransactionType" AS ENUM ('EP_AWARD', 'GP_AWARD', 'ITEM_AWARD', 'DEDUCTION', 'ADJUSTMENT', 'DECAY', 'IMPORT', 'REVERSAL');
CREATE TYPE "ReadinessStatus" AS ENUM ('READY', 'PARTIAL', 'NOT_READY', 'UNKNOWN');
CREATE TYPE "ReadinessFindingSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR');
ALTER TYPE "AuditAction" ADD VALUE 'EPGP_TRANSACTION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'READINESS_SNAPSHOT_RECORDED';

ALTER TABLE "GuildSettings"
  ADD COLUMN "epgpDecayPercent" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
  ADD COLUMN "epgpDecayIntervalHours" INTEGER NOT NULL DEFAULT 168,
  ADD COLUMN "epgpEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "EpgpTransaction" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "epAmount" INTEGER NOT NULL DEFAULT 0,
  "gpAmount" INTEGER NOT NULL DEFAULT 0,
  "type" "EpgpTransactionType" NOT NULL,
  "reason" TEXT NOT NULL,
  "sourceRef" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EpgpTransaction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EpgpTransaction_memberId_createdAt_idx" ON "EpgpTransaction"("memberId", "createdAt");
CREATE INDEX "EpgpTransaction_guildId_createdAt_idx" ON "EpgpTransaction"("guildId", "createdAt");
CREATE INDEX "EpgpTransaction_guildId_sourceRef_idx" ON "EpgpTransaction"("guildId", "sourceRef");
ALTER TABLE "EpgpTransaction" ADD CONSTRAINT "EpgpTransaction_guildId_fkey"
  FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EpgpTransaction" ADD CONSTRAINT "EpgpTransaction_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "InspectedCharacterSnapshot" (
  "id" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" TEXT NOT NULL,
  "status" "ReadinessStatus" NOT NULL DEFAULT 'UNKNOWN',
  "itemLevel" DOUBLE PRECISION,
  "rawPayload" JSONB,
  CONSTRAINT "InspectedCharacterSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InspectedCharacterSnapshot_characterId_inspectedAt_idx" ON "InspectedCharacterSnapshot"("characterId", "inspectedAt");
CREATE INDEX "InspectedCharacterSnapshot_memberId_inspectedAt_idx" ON "InspectedCharacterSnapshot"("memberId", "inspectedAt");
ALTER TABLE "InspectedCharacterSnapshot" ADD CONSTRAINT "InspectedCharacterSnapshot_characterId_fkey"
  FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InspectedCharacterSnapshot" ADD CONSTRAINT "InspectedCharacterSnapshot_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CharacterItem" (
  "id" TEXT NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "slot" TEXT NOT NULL,
  "itemId" TEXT,
  "itemName" TEXT NOT NULL,
  "itemLevel" INTEGER,
  "durability" INTEGER,
  CONSTRAINT "CharacterItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CharacterItem_snapshotId_slot_key" ON "CharacterItem"("snapshotId", "slot");
CREATE INDEX "CharacterItem_itemName_idx" ON "CharacterItem"("itemName");
ALTER TABLE "CharacterItem" ADD CONSTRAINT "CharacterItem_snapshotId_fkey"
  FOREIGN KEY ("snapshotId") REFERENCES "InspectedCharacterSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CharacterEnchant" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "slot" TEXT NOT NULL,
  "enchantId" TEXT,
  "name" TEXT NOT NULL,
  CONSTRAINT "CharacterEnchant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CharacterEnchant_itemId_slot_key" ON "CharacterEnchant"("itemId", "slot");
ALTER TABLE "CharacterEnchant" ADD CONSTRAINT "CharacterEnchant_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "CharacterItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CharacterConsumable" (
  "id" TEXT NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "category" TEXT,
  CONSTRAINT "CharacterConsumable_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CharacterConsumable_snapshotId_name_key" ON "CharacterConsumable"("snapshotId", "name");
ALTER TABLE "CharacterConsumable" ADD CONSTRAINT "CharacterConsumable_snapshotId_fkey"
  FOREIGN KEY ("snapshotId") REFERENCES "InspectedCharacterSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ReadinessFinding" (
  "id" TEXT NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "severity" "ReadinessFindingSeverity" NOT NULL,
  "message" TEXT NOT NULL,
  "resolved" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "ReadinessFinding_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReadinessFinding_snapshotId_severity_idx" ON "ReadinessFinding"("snapshotId", "severity");
ALTER TABLE "ReadinessFinding" ADD CONSTRAINT "ReadinessFinding_snapshotId_fkey"
  FOREIGN KEY ("snapshotId") REFERENCES "InspectedCharacterSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
