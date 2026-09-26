-- CreateTable
CREATE TABLE "UnclaimedCharacter" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "realm" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "race" TEXT,
    "level" INTEGER,
    "spec" TEXT,
    "professions" JSONB,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnclaimedCharacter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UnclaimedCharacter_guildId_nameKey_key" ON "UnclaimedCharacter"("guildId", "nameKey");

-- AddForeignKey
ALTER TABLE "UnclaimedCharacter" ADD CONSTRAINT "UnclaimedCharacter_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
