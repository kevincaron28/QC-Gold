import { createHash } from "node:crypto";
import { DkpTransactionType, type PrismaClient } from "@prisma/client";
import { normalizeAddonSnapshot, parseAddonSnapshot, type AddonSnapshot } from "../integrations/addon.js";

export function createAddonImportService(database: PrismaClient) {
  return {
    parse(payload: unknown): AddonSnapshot {
      return normalizeAddonSnapshot(parseAddonSnapshot(payload));
    },

    async preview(guildId: string, payload: unknown, createdBy: string) {
      const snapshot = this.parse(payload);
      const checksum = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
      const existing = await database.addonImport.findFirst({ where: { guildId, checksum } });
      return {
        snapshot,
        checksum,
        duplicate: existing !== null,
        transactionCount: snapshot.transactions.length,
        createdBy
      };
    },

    async record(guildId: string, snapshot: AddonSnapshot, checksum: string, createdBy: string) {
      return database.addonImport.create({
        data: {
          guildId,
          source: snapshot.source,
          checksum,
          status: "PREVIEWED",
          payload: snapshot,
          createdBy
        }
      });
    },

    async apply(guildId: string, importId: string, appliedBy: string) {
      return database.$transaction(async (tx) => {
        const imported = await tx.addonImport.findFirst({ where: { id: importId, guildId } });
        if (!imported) throw new Error("Addon import not found.");
        if (imported.status === "APPLIED") throw new Error("Addon import has already been applied.");
        const snapshot = parseAddonSnapshot(imported.payload);
        const characters = await tx.character.findMany({
          where: { member: { guildId } },
          include: { member: true }
        });
        const transactions = [];
        for (const item of snapshot.transactions) {
          const character = characters.find((candidate) =>
            candidate.name.toLowerCase() === item.character.toLowerCase() &&
            candidate.realm.toLowerCase() === item.realm.toLowerCase()
          );
          if (!character) throw new Error(`No linked character found for ${item.character} (${item.realm}).`);
          transactions.push(await tx.dkpTransaction.create({
            data: {
              guildId,
              memberId: character.memberId,
              amount: item.amount,
              type: DkpTransactionType.IMPORT,
              reason: item.reason,
              sourceRef: `addon:${importId}:${item.sourceRef ?? item.character}`,
              createdBy: appliedBy
            }
          }));
        }
        await tx.addonImport.update({
          where: { id: imported.id },
          data: { status: "APPLIED" }
        });
        return { import: imported, transactions };
      });
    }
  };
}
