import type { PrismaClient } from "@prisma/client";
import { findCharacter } from "./character-match.js";
import { itemKey } from "./wishlist.js";

// Reads a SoftRes.it reserves export (the CSV from a raid page) and turns each
// reserve into a wishlist entry on the matching guild character.
//
//   Item Name,Item ID,From,Raider Name,Raider Class,Raider Spec,Raider Note,Extra Reserves,Date
//   Ancient Cornerstone Grimoire,17067,Onyxia,Ray,Priest,Holy,,0,2026-09-26 21:36:24
//
// SoftRes also offers an item setup file (itemId,Item,hard reserved,...): that has
// no players in it, so it is refused with a clear message.

export interface SoftresRow {
  item: string;
  itemId: string;
  from: string;
  raider: string;
  className: string;
}

export interface SoftresParse {
  rows: SoftresRow[];
  skipped: number;
}

// Comma-separated values with "quoted, fields" and "" escapes; handles CRLF and a BOM.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const source = text.replace(/^﻿/, "");
  for (let i = 0; i < source.length; i++) {
    const char = source[i]!;
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
    } else field += char;
  }
  row.push(field);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

export function parseSoftresCsv(text: string): SoftresParse {
  const table = parseCsv(text);
  const header = (table[0] ?? []).map((cell) => cell.trim().toLowerCase());
  if (header.includes("hard reserved") && !header.includes("raider name")) {
    throw new Error("That is SoftRes's item setup file (no players in it). On the raid page, export the reserves instead: the CSV whose columns start with Item Name, Item ID, From, Raider Name.");
  }
  const col = (name: string) => header.indexOf(name);
  const itemCol = col("item name");
  const raiderCol = col("raider name");
  if (itemCol < 0 || raiderCol < 0) {
    throw new Error("That does not look like a SoftRes reserves export (expected the columns Item Name and Raider Name).");
  }
  const idCol = col("item id");
  const fromCol = col("from");
  const classCol = col("raider class");
  const rows: SoftresRow[] = [];
  let skipped = 0;
  for (const cells of table.slice(1)) {
    const item = (cells[itemCol] ?? "").trim();
    const raider = (cells[raiderCol] ?? "").trim();
    if (item.length < 2 || !raider) { skipped++; continue; }
    rows.push({
      item: item.slice(0, 100),
      itemId: idCol >= 0 ? (cells[idCol] ?? "").trim() : "",
      from: fromCol >= 0 ? (cells[fromCol] ?? "").trim() : "",
      raider,
      className: classCol >= 0 ? (cells[classCol] ?? "").trim() : ""
    });
  }
  return { rows, skipped };
}

export interface SoftresSummary {
  added: number;
  updated: number;
  unchanged: number;
  skipped: number;
  /** Raider names that are not a linked character in this guild, with how many reserves each had. */
  unmatched: { name: string; reserves: number }[];
  players: number;
}

export function createSoftresImportService(database: PrismaClient) {
  return {
    async apply(guildId: string, parsed: SoftresParse, priority = 1): Promise<SoftresSummary> {
      if (!Number.isInteger(priority) || priority < 1 || priority > 3) throw new Error("Priority must be 1 (high), 2 (medium) or 3 (low).");
      const characters = await database.character.findMany({ where: { member: { guildId } }, select: { id: true, name: true, realm: true } });
      const summary: SoftresSummary = { added: 0, updated: 0, unchanged: 0, skipped: parsed.skipped, unmatched: [], players: 0 };
      const unmatched = new Map<string, number>();
      const matchedIds = new Set<string>();
      for (const row of parsed.rows) {
        // SoftRes names carry no realm: match by name, as long as it is unique in the guild.
        const character = findCharacter(characters, row.raider, "");
        if (!character) { unmatched.set(row.raider, (unmatched.get(row.raider) ?? 0) + 1); continue; }
        matchedIds.add(character.id);
        const key = itemKey(row.item);
        const existing = await database.wishlistEntry.findUnique({ where: { characterId_itemKey: { characterId: character.id, itemKey: key } } });
        if (!existing) {
          await database.wishlistEntry.create({ data: { characterId: character.id, itemKey: key, itemName: row.item, priority } });
          summary.added++;
        } else if (existing.priority !== priority) {
          await database.wishlistEntry.update({ where: { id: existing.id }, data: { priority, itemName: row.item } });
          summary.updated++;
        } else summary.unchanged++;
      }
      summary.players = matchedIds.size;
      summary.unmatched = [...unmatched.entries()].map(([name, reserves]) => ({ name, reserves })).sort((a, b) => a.name.localeCompare(b.name));
      return summary;
    }
  };
}

export function softresReport(summary: SoftresSummary): string {
  const lines = [`SoftRes reserves read for ${summary.players} linked player(s): ${summary.added} added to wishlists, ${summary.updated} changed, ${summary.unchanged} already there.`];
  if (summary.unmatched.length > 0) {
    const names = summary.unmatched.map((entry) => `${entry.name}${entry.reserves > 1 ? ` (${entry.reserves})` : ""}`);
    lines.push(`Not linked to a character in this guild (skipped): ${names.slice(0, 20).join(", ")}${names.length > 20 ? ", ..." : ""}. They can link with /character add, or their name may be spelled differently on SoftRes.`);
  }
  if (summary.skipped > 0) lines.push(`${summary.skipped} row(s) had no item or no name and were skipped.`);
  return lines.join("\n");
}
