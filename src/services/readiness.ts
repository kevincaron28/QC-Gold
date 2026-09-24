import { Prisma, ReadinessFindingSeverity, ReadinessStatus, type PrismaClient } from "@prisma/client";

export interface SnapshotItem {
  slot: string;
  itemName: string;
  itemId?: string;
  itemLevel?: number;
  durability?: number;
  enchants?: Array<{ slot: string; name: string; enchantId?: string }>;
}

export interface SnapshotConsumable {
  name: string;
  quantity: number;
  category?: string;
}

export interface ReadinessFindingInput {
  code: string;
  severity: ReadinessFindingSeverity;
  message: string;
}

export interface RecordSnapshotInput {
  characterId: string;
  memberId: string;
  source: string;
  itemLevel?: number;
  items?: SnapshotItem[];
  consumables?: SnapshotConsumable[];
  findings?: ReadinessFindingInput[];
  rawPayload?: object;
}

export function deriveReadinessStatus(findings: ReadinessFindingInput[]): ReadinessStatus {
  if (findings.some((finding) => finding.severity === ReadinessFindingSeverity.ERROR)) {
    return ReadinessStatus.NOT_READY;
  }
  if (findings.some((finding) => finding.severity === ReadinessFindingSeverity.WARNING)) {
    return ReadinessStatus.PARTIAL;
  }
  return ReadinessStatus.READY;
}

export function createReadinessService(database: PrismaClient) {
  return {
    recordSnapshot(input: RecordSnapshotInput) {
      const findings = input.findings ?? [];
      return database.inspectedCharacterSnapshot.create({
        data: {
          characterId: input.characterId,
          memberId: input.memberId,
          source: input.source.trim(),
          status: deriveReadinessStatus(findings),
          itemLevel: input.itemLevel ?? null,
          rawPayload: input.rawPayload === undefined
            ? Prisma.JsonNull
            : (input.rawPayload as Prisma.InputJsonValue),
          items: {
            create: (input.items ?? []).map((item) => ({
              slot: item.slot,
              itemName: item.itemName,
              itemId: item.itemId ?? null,
              itemLevel: item.itemLevel ?? null,
              durability: item.durability ?? null,
              enchants: {
                create: (item.enchants ?? []).map((enchant) => ({
                  slot: enchant.slot,
                  name: enchant.name,
                  enchantId: enchant.enchantId ?? null
                }))
              }
            }))
          },
          consumables: {
            create: (input.consumables ?? []).map((consumable) => ({
              name: consumable.name,
              quantity: consumable.quantity,
              category: consumable.category ?? null
            }))
          },
          findings: {
            create: findings.map((finding) => ({
              code: finding.code,
              severity: finding.severity,
              message: finding.message
            }))
          }
        },
        include: { items: { include: { enchants: true } }, consumables: true, findings: true }
      });
    },

    getLatest(characterId: string) {
      return database.inspectedCharacterSnapshot.findFirst({
        where: { characterId },
        orderBy: { inspectedAt: "desc" },
        include: { items: { include: { enchants: true } }, consumables: true, findings: true }
      });
    },

    listFindings(snapshotId: string) {
      return database.readinessFinding.findMany({
        where: { snapshotId, resolved: false },
        orderBy: { severity: "desc" }
      });
    }
  };
}
