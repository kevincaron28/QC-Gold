import type { PrismaClient } from "@prisma/client";
import { clean } from "./item-insights.js";
import { itemKey } from "./wishlist.js";

// Set GP prices for EPGP priority loot: "Sulfuras = 250". A core has its own list; items it does not
// list use the guild-wide price (core "" ) when there is one. The key is the lower-case item name
// (cleaned like the addon's tooltip keys), or "#id" for a price given by item id alone.

export const GUILD_DEFAULT = "";
export const MAX_GP = 100_000;
const MAX_LINES = 500;

export interface ParsedValue { name: string | null; id: number | null; gp: number }
export interface ParsedValues { values: ParsedValue[]; problems: string[] }

// One item per line, price last: "Sulfuras, Hand of Ragnaros = 250", "Sulfuras;250", "19019 120",
// "id:19019 = 120". A price without "GP" or a header row is fine; blank lines are skipped.
export function parseItemValues(text: string): ParsedValues {
  const values: ParsedValue[] = [];
  const problems: string[] = [];
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length > MAX_LINES) problems.push(`Only the first ${MAX_LINES} lines are read.`);
  for (const line of lines.slice(0, MAX_LINES)) {
    const match = /^(.*?)\s*[=;\t,:]\s*(\d{1,6})\s*(?:gp)?$/i.exec(line) ?? /^(.*\S)\s+(\d{1,6})\s*(?:gp)?$/i.exec(line);
    if (!match) {
      // A header such as "Item,GP" is not worth complaining about.
      if (!/^\W*item/i.test(line)) problems.push(`Not understood: "${line.slice(0, 60)}"`);
      continue;
    }
    const label = match[1]!.replace(/^["']|["']$/g, "").trim();
    const gp = Number(match[2]);
    if (gp > MAX_GP) { problems.push(`"${label.slice(0, 40)}": ${gp} GP is too high (limit ${MAX_GP}).`); continue; }
    const idMatch = /^(?:id\s*:?\s*|#)?(\d{2,7})$/i.exec(label);
    if (idMatch) values.push({ name: null, id: Number(idMatch[1]), gp });
    else if (label.length >= 2 && label.length <= 100) values.push({ name: label, id: null, gp });
    else problems.push(`Not understood: "${line.slice(0, 60)}"`);
  }
  return { values, problems };
}

export const keyOf = (value: { name: string | null; id: number | null }): string =>
  value.name ? clean(itemKey(value.name)) : `#${value.id}`;

type Db = Pick<PrismaClient, "coreItemValue">;

export interface ValueRow { key: string; id: number | null; name: string; gp: number }

export function createItemValueService(database: Db) {
  return {
    // Saves prices for a core (or the guild default when coreId is null). Returns how many rows changed.
    async setMany(guildId: string, coreId: string | null, values: ParsedValue[]): Promise<number> {
      let changed = 0;
      for (const value of values) {
        const key = keyOf(value);
        if (key.length < 2) continue;
        const data = { itemId: value.id, itemName: value.name ?? `Item ${value.id}`, gp: value.gp };
        await database.coreItemValue.upsert({
          where: { guildId_coreId_itemKey: { guildId, coreId: coreId ?? GUILD_DEFAULT, itemKey: key } },
          create: { guildId, coreId: coreId ?? GUILD_DEFAULT, itemKey: key, ...data },
          update: data
        });
        changed++;
      }
      return changed;
    },

    async remove(guildId: string, coreId: string | null, item: { name: string | null; id: number | null }): Promise<boolean> {
      const result = await database.coreItemValue.deleteMany({ where: { guildId, coreId: coreId ?? GUILD_DEFAULT, itemKey: keyOf(item) } });
      return result.count > 0;
    },

    async clear(guildId: string, coreId: string | null): Promise<number> {
      return (await database.coreItemValue.deleteMany({ where: { guildId, coreId: coreId ?? GUILD_DEFAULT } })).count;
    },

    async list(guildId: string, coreId: string | null): Promise<ValueRow[]> {
      const rows = await database.coreItemValue.findMany({ where: { guildId, coreId: coreId ?? GUILD_DEFAULT }, orderBy: { itemName: "asc" } });
      return rows.map((row) => ({ key: row.itemKey, id: row.itemId, name: row.itemName, gp: row.gp }));
    },

    // The prices a core actually uses: the guild-wide list with the core's own prices on top.
    async effective(guildId: string, coreId: string | null): Promise<ValueRow[]> {
      const rows = await database.coreItemValue.findMany({
        where: { guildId, coreId: { in: coreId ? [GUILD_DEFAULT, coreId] : [GUILD_DEFAULT] } },
        orderBy: { itemName: "asc" }
      });
      const merged = new Map<string, ValueRow>();
      for (const row of rows.filter((r) => r.coreId === GUILD_DEFAULT)) merged.set(row.itemKey, { key: row.itemKey, id: row.itemId, name: row.itemName, gp: row.gp });
      for (const row of rows.filter((r) => r.coreId !== GUILD_DEFAULT)) merged.set(row.itemKey, { key: row.itemKey, id: row.itemId, name: row.itemName, gp: row.gp });
      return [...merged.values()];
    },

    // The price of one item for a core: by name, then by id. null when nobody set one.
    async priceOf(guildId: string, coreId: string | null, item: { name?: string | null; id?: number | null }): Promise<number | null> {
      const keys = [item.name ? clean(itemKey(item.name)) : null, item.id ? `#${item.id}` : null].filter((key): key is string => !!key);
      if (keys.length === 0) return null;
      const rows = await database.coreItemValue.findMany({
        where: { guildId, itemKey: { in: keys }, coreId: { in: coreId ? [GUILD_DEFAULT, coreId] : [GUILD_DEFAULT] } }
      });
      // The core's own price beats the guild's; a name match beats an id match.
      const order = (row: (typeof rows)[number]) => (row.coreId === GUILD_DEFAULT ? 0 : 2) + (row.itemKey.startsWith("#") ? 0 : 1);
      return rows.sort((a, b) => order(b) - order(a))[0]?.gp ?? null;
    }
  };
}

export function describeValues(title: string, rows: ValueRow[]): string {
  if (rows.length === 0) return `${title}: no prices set yet.`;
  const lines = rows.map((row) => `• ${row.name}${row.id && !row.name.startsWith("Item ") ? ` (#${row.id})` : ""} — ${row.gp} GP`);
  const text = `${title} (${rows.length}):\n${lines.join("\n")}`;
  if (text.length <= 1900) return text;
  let used = title.length + 12;
  const kept: string[] = [];
  for (const line of lines) {
    if (used + line.length + 1 > 1850) break;
    kept.push(line);
    used += line.length + 1;
  }
  return `${title} (${rows.length}):\n${kept.join("\n")}\n…and ${rows.length - kept.length} more.`;
}
