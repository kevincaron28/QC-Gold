-- CreateTable
CREATE TABLE "CharacterAttunement" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT true,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterAttunement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CharacterAttunement_characterId_completed_idx" ON "CharacterAttunement"("characterId", "completed");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterAttunement_characterId_name_key" ON "CharacterAttunement"("characterId", "name");

-- AddForeignKey
ALTER TABLE "CharacterAttunement" ADD CONSTRAINT "CharacterAttunement_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
