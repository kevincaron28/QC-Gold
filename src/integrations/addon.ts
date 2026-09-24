import { z } from "zod";

export const addonTransactionSchema = z.object({
  character: z.string().min(1),
  realm: z.string().min(1),
  amount: z.number().int().refine((amount) => amount !== 0, "must not be zero"),
  type: z.enum(["AWARD", "DEDUCTION", "ADJUSTMENT", "REFUND", "DECAY", "IMPORT"]),
  reason: z.string().min(3),
  sourceRef: z.string().min(1).optional()
});

const addonItemSchema = z.object({
  slot: z.string().min(1),
  itemName: z.string().min(1),
  itemId: z.string().min(1).optional(),
  itemLevel: z.number().int().nonnegative().optional(),
  durability: z.number().int().min(0).max(100).optional(),
  enchants: z.array(z.object({
    slot: z.string().min(1),
    name: z.string().min(1),
    enchantId: z.string().min(1).optional()
  })).default([])
});

const addonConsumableSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().nonnegative(),
  category: z.string().min(1).optional()
});

const addonFindingSchema = z.object({
  code: z.string().min(1),
  severity: z.enum(["INFO", "WARNING", "ERROR"]),
  message: z.string().min(1)
});

const addonReadinessSchema = z.object({
  character: z.string().min(1),
  realm: z.string().min(1),
  itemLevel: z.number().nonnegative().optional(),
  items: z.array(addonItemSchema).default([]),
  consumables: z.array(addonConsumableSchema).default([]),
  findings: z.array(addonFindingSchema).default([]),
  inspectedAt: z.coerce.date().optional()
});

export const addonSnapshotSchema = z.object({
  source: z.string().min(1),
  exportedAt: z.coerce.date(),
  transactions: z.array(addonTransactionSchema).default([]),
  readiness: z.array(addonReadinessSchema).default([])
});

export type AddonSnapshot = z.infer<typeof addonSnapshotSchema>;

export function parseAddonSnapshot(payload: unknown): AddonSnapshot {
  return addonSnapshotSchema.parse(payload);
}

export function normalizeAddonSnapshot(snapshot: AddonSnapshot): AddonSnapshot {
  return {
    ...snapshot,
    source: snapshot.source.trim(),
    transactions: snapshot.transactions.map((transaction) => ({
      ...transaction,
      character: transaction.character.trim(),
      realm: transaction.realm.trim(),
      reason: transaction.reason.trim(),
      sourceRef: transaction.sourceRef?.trim()
    })),
    readiness: snapshot.readiness.map((entry) => ({
      ...entry,
      character: entry.character.trim(),
      realm: entry.realm.trim(),
      items: entry.items.map((item) => ({
        ...item,
        slot: item.slot.trim(),
        itemName: item.itemName.trim(),
        enchants: item.enchants.map((enchant) => ({ ...enchant, slot: enchant.slot.trim(), name: enchant.name.trim() }))
      })),
      consumables: entry.consumables.map((consumable) => ({ ...consumable, name: consumable.name.trim() })),
      findings: entry.findings.map((finding) => ({ ...finding, code: finding.code.trim(), message: finding.message.trim() }))
    }))
  };
}
