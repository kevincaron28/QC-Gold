import type { PrismaClient } from "@prisma/client";
import { raidEpRef } from "./ep-award.js";

export interface RaidReport {
  title: string;
  startedAt: Date | null;
  endedAt: Date | null;
  durationMinutes: number | null;
  raiders: number;
  late: number;
  absent: number;
  bossesKilled: number;
  bossesPlanned: number;
  killedNames: string[];
  epAwarded: number;
  epRecipients: number;
  lootCount: number;
  gpSpent: number;
  topLoot: { item: string; winner: string; gp: number }[];
}

type Db = Pick<PrismaClient, "raid" | "epgpTransaction" | "lootAward">;

// Summary of one raid from what the bot already knows: attendance, boss
// kills, the EP approved for it, and loot tied to it (via /loot auction
// raid:). Deliberately no per-player performance numbers.
export async function buildRaidReport(database: Db, guildId: string, raidId: string): Promise<RaidReport> {
  const raid = await database.raid.findFirst({
    where: { id: raidId, guildId },
    include: { bosses: { orderBy: { sortOrder: "asc" } }, attendance: true }
  });
  if (!raid) throw new Error("Raid not found in this guild.");
  const [epRows, loot] = await Promise.all([
    database.epgpTransaction.findMany({
      where: { guildId, sourceRef: { startsWith: raidEpRef(raidId, "") } },
      select: { epAmount: true }
    }),
    database.lootAward.findMany({
      where: { guildId, raidId },
      include: { member: true },
      orderBy: { amount: "desc" }
    })
  ]);
  const killed = raid.bosses.filter((boss) => boss.status === "KILLED");
  const durationMinutes = raid.startedAt && raid.endedAt
    ? Math.max(0, Math.round((raid.endedAt.getTime() - raid.startedAt.getTime()) / 60_000))
    : null;
  return {
    title: raid.title,
    startedAt: raid.startedAt,
    endedAt: raid.endedAt,
    durationMinutes,
    raiders: raid.attendance.filter((row) => row.status === "PRESENT" || row.status === "LATE").length,
    late: raid.attendance.filter((row) => row.status === "LATE").length,
    absent: raid.attendance.filter((row) => row.status === "ABSENT").length,
    bossesKilled: killed.length,
    bossesPlanned: raid.bosses.length,
    killedNames: killed.map((boss) => boss.name),
    epAwarded: epRows.reduce((sum, row) => sum + row.epAmount, 0),
    epRecipients: epRows.length,
    lootCount: loot.length,
    gpSpent: loot.reduce((sum, award) => sum + award.amount, 0),
    topLoot: loot.slice(0, 5).map((award) => ({ item: award.itemName, winner: award.member.displayName, gp: award.amount }))
  };
}

export function formatDuration(minutes: number | null): string {
  if (minutes === null) return "unknown";
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}
