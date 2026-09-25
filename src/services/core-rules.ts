import type { GuildSettings, PrismaClient, RaidCore } from "@prisma/client";

// Point rules per raid core. Every core follows the guild's settings (from
// /config and /setup) unless it overrides a value with /core rules, so a
// guild that never touches /core rules gets identical rules for all cores.
// A core may also keep its own point pool (its EP/GP are separate from the
// guild pool and from other cores').

export interface EffectiveRules {
  attendanceEp: number;
  lateEp: number;
  bossEp: number;
  completionEp: number;
  baseGp: number;
  decayPercent: number;
  lootMode: "EPGP" | "COUNCIL";
  separatePool: boolean;
  // Which values this core changed (the rest are the guild default).
  overridden: string[];
}

type CoreRules = Pick<RaidCore, "attendanceEp" | "lateEp" | "bossEp" | "completionEp" | "baseGp" | "decayPercent" | "lootMode" | "separatePool">;
type GuildRules = Pick<GuildSettings, "attendanceDkp" | "lateAttendanceDkp" | "bossKillDkp" | "epCompletionBonus" | "baseGp" | "epgpDecayPercent" | "lootMode">;

export function effectiveRules(guild: Partial<GuildRules> | null | undefined, core: Partial<CoreRules> | null | undefined): EffectiveRules {
  const overridden: string[] = [];
  const pick = <T>(name: string, own: T | null | undefined, fallback: T): T => {
    if (own !== null && own !== undefined) { overridden.push(name); return own; }
    return fallback;
  };
  const attendanceEp = pick("attendance EP", core?.attendanceEp, guild?.attendanceDkp ?? 10);
  const lateEp = pick("late EP", core?.lateEp, guild?.lateAttendanceDkp ?? 5);
  const bossEp = pick("boss EP", core?.bossEp, guild?.bossKillDkp ?? 5);
  const completionEp = pick("full-clear EP", core?.completionEp, guild?.epCompletionBonus ?? 0);
  const baseGp = pick("base GP", core?.baseGp, guild?.baseGp ?? 0);
  const decayPercent = pick("decay", core?.decayPercent, guild?.epgpDecayPercent ?? 0.1);
  const mode = pick("loot mode", core?.lootMode, guild?.lootMode ?? "EPGP");
  const separatePool = core?.separatePool === true;
  if (separatePool) overridden.push("separate pool");
  return {
    attendanceEp, lateEp, bossEp, completionEp, baseGp, decayPercent,
    lootMode: mode === "COUNCIL" ? "COUNCIL" : "EPGP",
    separatePool,
    overridden
  };
}

// "attendance 10 EP (default), boss 0 EP (this core), ..." for /core rules and /core show.
export function describeRules(rules: EffectiveRules, coreName: string): string {
  const mark = (name: string) => (rules.overridden.includes(name) ? "core" : "default");
  return [
    `**${coreName}** rules (${rules.overridden.length ? `${rules.overridden.length} differ from the guild` : "same as the guild"}):`,
    `• Attendance ${rules.attendanceEp} EP (${mark("attendance EP")}) · late ${rules.lateEp} EP (${mark("late EP")})`,
    `• Per boss ${rules.bossEp} EP (${mark("boss EP")}) · full clear +${rules.completionEp} EP (${mark("full-clear EP")})`,
    `• Base GP ${rules.baseGp} (${mark("base GP")}) · decay ${Math.round(rules.decayPercent * 100)}% (${mark("decay")})`,
    `• Loot: ${rules.lootMode === "COUNCIL" ? "loot council" : "GP bids"} (${mark("loot mode")})`,
    `• Points: ${rules.separatePool ? "this core has its **own point pool**" : "shared guild pool"}`
  ].join("\n");
}

type Db = Pick<PrismaClient, "raid">;

// The core a raid was created for (with its rules), or null.
export async function coreForRaid(database: Db, guildId: string, raidId: string | null | undefined) {
  if (!raidId) return null;
  const raid = await database.raid.findFirst({ where: { id: raidId.trim(), guildId }, include: { core: true } });
  return raid?.core ?? null;
}

// Which pool a raid's points go to: the core's id when it has its own pool,
// otherwise null (the guild pool).
export const poolFor = (core: Pick<RaidCore, "id" | "separatePool"> | null | undefined): string | null =>
  core?.separatePool ? core.id : null;
