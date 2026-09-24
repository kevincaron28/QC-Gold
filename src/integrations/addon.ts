import { z } from "zod";

export const addonTransactionSchema = z.object({
  character: z.string().min(1),
  realm: z.string().min(1),
  amount: z.number().int().refine((amount) => amount !== 0, "must not be zero"),
  type: z.enum(["AWARD", "DEDUCTION", "ADJUSTMENT", "REFUND", "DECAY", "IMPORT"]),
  reason: z.string().min(3),
  sourceRef: z.string().min(1).optional()
});

// Separate from addonTransactionSchema because the addon's EPGP ledger tracks
// EP and GP independently per entry, not a single signed amount.
export const addonEpgpTransactionSchema = z.object({
  character: z.string().min(1),
  realm: z.string().min(1),
  epAmount: z.number().int().default(0),
  gpAmount: z.number().int().default(0),
  type: z.enum(["EP_AWARD", "GP_AWARD", "ITEM_AWARD", "DEDUCTION", "ADJUSTMENT", "DECAY", "IMPORT", "REVERSAL"]),
  reason: z.string().min(3),
  sourceRef: z.string().min(1).optional()
}).refine((transaction) => transaction.epAmount !== 0 || transaction.gpAmount !== 0, "must change EP or GP");

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

const addonProfessionSchema = z.object({
  name: z.string().min(1),
  skillLevel: z.number().int().nonnegative()
});

const addonReadinessSchema = z.object({
  character: z.string().min(1),
  realm: z.string().min(1),
  itemLevel: z.number().nonnegative().optional(),
  items: z.array(addonItemSchema).default([]),
  consumables: z.array(addonConsumableSchema).default([]),
  professions: z.array(addonProfessionSchema).default([]),
  findings: z.array(addonFindingSchema).default([]),
  inspectedAt: z.coerce.date().optional()
});

// Attunement completion is self- or officer-reported in the addon (there is
// no reliable, server-agnostic quest-completion API to auto-detect this), so
// it travels as its own array rather than inside a point-in-time readiness
// snapshot.
export const addonAttunementSchema = z.object({
  character: z.string().min(1),
  realm: z.string().min(1),
  name: z.string().min(1),
  completed: z.boolean().default(true)
});

export const addonSnapshotSchema = z.object({
  source: z.string().min(1),
  exportedAt: z.coerce.date(),
  transactions: z.array(addonTransactionSchema).default([]),
  epgpTransactions: z.array(addonEpgpTransactionSchema).default([]),
  readiness: z.array(addonReadinessSchema).default([]),
  attunements: z.array(addonAttunementSchema).default([])
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
    epgpTransactions: snapshot.epgpTransactions.map((transaction) => ({
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
      professions: entry.professions.map((profession) => ({ ...profession, name: profession.name.trim() })),
      findings: entry.findings.map((finding) => ({ ...finding, code: finding.code.trim(), message: finding.message.trim() }))
    })),
    attunements: snapshot.attunements.map((attunement) => ({
      ...attunement,
      character: attunement.character.trim(),
      realm: attunement.realm.trim(),
      name: attunement.name.trim()
    }))
  };
}
