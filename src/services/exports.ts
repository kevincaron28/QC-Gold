import type { PrismaClient } from "@prisma/client";

// CSV exports for officers who live in spreadsheets: roster, attendance, loot.

export type ExportKind = "roster" | "attendance" | "loot" | "epgp";
type Cell = string | number | boolean | Date | null | undefined;

// Cells that start with = + - @ are prefixed so a spreadsheet never treats
// player-typed text as a formula.
export function csvCell(value: Cell): string {
  let text = value instanceof Date ? value.toISOString() : value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text) && Number.isNaN(Number(text))) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: Cell[][]): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

type Db = Pick<PrismaClient, "member" | "raidAttendance" | "lootAward" | "epgpTransaction">;

export async function buildExport(database: Db, guildId: string, kind: ExportKind): Promise<{ filename: string; csv: string; rows: number }> {
  if (kind === "roster") {
    const members = await database.member.findMany({
      where: { guildId, status: "ACTIVE", isTest: false }, include: { characters: true }, orderBy: { displayName: "asc" }
    });
    const rows = members.flatMap((member) => member.characters.length
      ? member.characters.map((c) => [member.displayName, c.name, c.realm, c.className, c.spec, c.level, c.race, c.isMain, c.lastSeenAt])
      : [[member.displayName, "", "", "", "", "", "", "", ""]]);
    return { filename: "roster.csv", rows: rows.length, csv: toCsv(["member", "character", "realm", "class", "spec", "level", "race", "main", "last_seen"], rows) };
  }
  if (kind === "attendance") {
    const records = await database.raidAttendance.findMany({
      where: { raid: { guildId, isTest: false } }, include: { raid: true, member: true }, orderBy: { raid: { scheduledAt: "desc" } }, take: 20_000
    });
    const rows = records.map((r) => [r.raid.title, r.raid.scheduledAt, r.member.displayName, r.status, r.notes]);
    return { filename: "attendance.csv", rows: rows.length, csv: toCsv(["raid", "date", "member", "status", "notes"], rows) };
  }
  if (kind === "loot") {
    const awards = await database.lootAward.findMany({ where: { guildId }, include: { member: true }, orderBy: { awardedAt: "desc" }, take: 20_000 });
    const rows = awards.map((a) => [a.awardedAt, a.member.displayName, a.itemName, a.amount, a.bossName, a.epBefore, a.gpBefore]);
    return { filename: "loot.csv", rows: rows.length, csv: toCsv(["date", "winner", "item", "gp", "boss", "ep_before", "gp_before"], rows) };
  }
  const entries = await database.epgpTransaction.findMany({ where: { guildId }, include: { member: true }, orderBy: { createdAt: "desc" }, take: 20_000 });
  const rows = entries.map((e) => [e.createdAt, e.member.displayName, e.type, e.epAmount, e.gpAmount, e.reason]);
  return { filename: "epgp-ledger.csv", rows: rows.length, csv: toCsv(["date", "member", "type", "ep", "gp", "reason"], rows) };
}
