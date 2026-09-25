import type { Guild as DiscordGuild } from "discord.js";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "../database.js";
import { createGuildService } from "./guild.js";

const guildService = createGuildService(prisma);

type Db = Pick<PrismaClient, "member" | "inspectedCharacterSnapshot"> & Partial<Pick<PrismaClient, "consumableCheck">>;

// A scan older than this is stale (flasks last about two hours).
export const CONSUMABLE_MAX_AGE_MS = 3 * 60 * 60 * 1000;

const ICON: Record<string, string> = { READY: "✅", PARTIAL: "⚠️", NOT_READY: "❌" };

// One block per active member: their latest gear check from the addon.
// Ready players get a single line; anyone else lists what's wrong.
export async function buildReadinessLines(database: Db, guildId: string): Promise<string[]> {
  const members = await database.member.findMany({ where: { guildId, status: "ACTIVE", isTest: false }, orderBy: { displayName: "asc" } });
  const lines: string[] = [];
  for (const member of members) {
    const snapshot = await database.inspectedCharacterSnapshot.findFirst({
      where: { memberId: member.id }, orderBy: { inspectedAt: "desc" }, include: { findings: true, character: true }
    });
    if (!snapshot) { lines.push(`❔ **${member.displayName}** — no gear check uploaded`); continue; }
    const problems = snapshot.findings.filter((finding) => finding.severity !== "INFO");
    const head = `${ICON[snapshot.status] ?? "❔"} **${snapshot.character.name}** — ${snapshot.status}${snapshot.itemLevel ? ` · ilvl ${snapshot.itemLevel}` : ""}`;
    lines.push(problems.length ? `${head}\n${problems.map((finding) => `   • ${finding.message}`).join("\n")}` : head);
  }
  return lines;
}

// "Consumables (scanned 12 min ago)": who lacks a flask/elixir or food in the
// latest group scan. Empty when there is no fresh scan.
export async function buildConsumableLines(database: Db, guildId: string, now = new Date()): Promise<string[]> {
  if (!database.consumableCheck) return [];
  const rows = await database.consumableCheck.findMany({
    where: { guildId, scannedAt: { gte: new Date(now.getTime() - CONSUMABLE_MAX_AGE_MS) } },
    orderBy: { character: "asc" }
  });
  if (rows.length === 0) return [];
  const newest = rows.reduce((latest, row) => (row.scannedAt > latest ? row.scannedAt : latest), rows[0]!.scannedAt);
  const minutes = Math.max(0, Math.round((now.getTime() - newest.getTime()) / 60_000));
  const noFlask = rows.filter((row) => !row.flask && row.elixirs.length === 0).map((row) => row.character);
  const noFood = rows.filter((row) => !row.food).map((row) => row.character);
  return [
    `🧪 **Consumables** — ${rows.length} scanned ${minutes} min ago`,
    `   No flask/elixir: ${noFlask.length ? noFlask.join(", ") : "nobody ✅"}`,
    `   No food: ${noFood.length ? noFood.join(", ") : "nobody ✅"}`
  ];
}

// Packs lines into messages under Discord's 2000-character limit.
export function chunkLines(lines: string[], limit = 1900): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const line of lines) {
    if (current && current.length + line.length + 1 > limit) { chunks.push(current); current = ""; }
    current = current ? `${current}\n${line}` : line.slice(0, limit);
  }
  if (current) chunks.push(current);
  return chunks;
}

// Posts the board in the readiness channel. False when none is set. Never
// throws: a failed post must not undo the import or command that triggered it.
export async function postReadinessBoard(discordGuild: DiscordGuild | null, guildId: string, reason: string): Promise<boolean> {
  if (!discordGuild) return false;
  try {
    const settings = await guildService.getSettings(guildId);
    if (!settings?.readinessChannelId) return false;
    const channel = await discordGuild.channels.fetch(settings.readinessChannelId).catch(() => null);
    if (!channel?.isTextBased()) return false;
    const lines = [...await buildReadinessLines(prisma, guildId), ...await buildConsumableLines(prisma, guildId)];
    const chunks = chunkLines(lines.length ? lines : ["No guild members found."], 1800);
    for (const [index, chunk] of chunks.entries()) {
      await channel.send({ content: index === 0 ? `**Raid readiness** — ${reason}\n${chunk}` : chunk, allowedMentions: { parse: [] } });
    }
    return true;
  } catch (error) {
    console.error("Failed to post readiness board", error);
    return false;
  }
}
