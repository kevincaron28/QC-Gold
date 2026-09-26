-- A core roster has main players and a bench of replacements.
ALTER TABLE "RaidCoreMember" ADD COLUMN "bench" BOOLEAN NOT NULL DEFAULT false;
