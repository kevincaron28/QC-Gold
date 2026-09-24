import { createHash } from "node:crypto";
import { DkpTransactionType, type EpgpTransactionType, type PrismaClient } from "@prisma/client";
import { normalizeAddonSnapshot, parseAddonSnapshot, type AddonSnapshot } from "../integrations/addon.js";
import { deriveReadinessStatus } from "./readiness.js";

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
        const epgpTransactions = [];
        for (const item of snapshot.epgpTransactions) {
          const character = characters.find((candidate) =>
            candidate.name.toLowerCase() === item.character.toLowerCase() &&
            candidate.realm.toLowerCase() === item.realm.toLowerCase()
          );
          if (!character) throw new Error(`No linked character found for ${item.character} (${item.realm}).`);
          epgpTransactions.push(await tx.epgpTransaction.create({
            data: {
              guildId,
              memberId: character.memberId,
              epAmount: item.epAmount,
              gpAmount: item.gpAmount,
              type: item.type as EpgpTransactionType,
              reason: item.reason,
              sourceRef: `addon:${importId}:${item.sourceRef ?? item.character}`,
              createdBy: appliedBy
            }
          }));
        }

        // Readiness is best-effort: an unlinked character shouldn't block the
        // DKP/EPGP transactions in the same import from being applied.
        const readinessSnapshots = [];
        for (const entry of snapshot.readiness) {
          const character = characters.find((candidate) =>
            candidate.name.toLowerCase() === entry.character.toLowerCase() &&
            candidate.realm.toLowerCase() === entry.realm.toLowerCase()
          );
          if (!character) continue;

          for (const profession of entry.professions) {
            await tx.professionSkill.upsert({
              where: { characterId_profession: { characterId: character.id, profession: profession.name } },
              create: { characterId: character.id, profession: profession.name, skillLevel: profession.skillLevel },
              update: { skillLevel: profession.skillLevel }
            });
          }

          readinessSnapshots.push(await tx.inspectedCharacterSnapshot.create({
            data: {
              characterId: character.id,
              memberId: character.memberId,
              source: snapshot.source,
              status: deriveReadinessStatus(entry.findings),
              itemLevel: entry.itemLevel ?? null,
              rawPayload: JSON.parse(JSON.stringify(entry)),
              items: {
                create: entry.items.map((item) => ({
                  slot: item.slot,
                  itemName: item.itemName,
                  itemId: item.itemId ?? null,
                  itemLevel: item.itemLevel ?? null,
                  durability: item.durability ?? null,
                  enchants: {
                    create: item.enchants.map((enchant) => ({
                      slot: enchant.slot,
                      name: enchant.name,
                      enchantId: enchant.enchantId ?? null
                    }))
                  }
                }))
              },
              consumables: {
                create: entry.consumables.map((consumable) => ({
                  name: consumable.name,
                  quantity: consumable.quantity,
                  category: consumable.category ?? null
                }))
              },
              findings: {
                create: entry.findings.map((finding) => ({
                  code: finding.code,
                  severity: finding.severity,
                  message: finding.message
                }))
              }
            }
          }));
        }

        // Attunements are self- or officer-reported, not financial — same
        // best-effort matching as readiness.
        const attunements = [];
        for (const entry of snapshot.attunements) {
          const character = characters.find((candidate) =>
            candidate.name.toLowerCase() === entry.character.toLowerCase() &&
            candidate.realm.toLowerCase() === entry.realm.toLowerCase()
          );
          if (!character) continue;
          attunements.push(await tx.characterAttunement.upsert({
            where: { characterId_name: { characterId: character.id, name: entry.name } },
            create: { characterId: character.id, name: entry.name, completed: entry.completed, source: snapshot.source, completedAt: new Date() },
            update: { completed: entry.completed, source: snapshot.source, completedAt: new Date() }
          }));
        }

        await tx.addonImport.update({
          where: { id: imported.id },
          data: { status: "APPLIED" }
        });
        return { import: imported, transactions, epgpTransactions, readinessSnapshots, attunements };
      });
    }
  };
}
