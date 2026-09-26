import type { Guild as DiscordGuild } from "discord.js";
import { prisma } from "../database.js";
import { autoLinkUnclaimed } from "./character-autolink.js";
import { dungeonAnnouncement } from "./dungeon-announce.js";
import { updateDungeonLeaderboard } from "./dungeon-leaderboard.js";
import { notifications, notify, notifyDungeon } from "./notify.js";
import { postReadinessBoard } from "./readiness-board.js";
import type { createAddonImportService } from "./addon-import.js";

type ImportResult = Awaited<ReturnType<ReturnType<typeof createAddonImportService>["apply"]>>;

// Everything that follows an applied import, whoever applied it (an officer
// with /import-apply, or the bot itself when auto-apply is on): link newly
// discovered characters by Discord name, announce the import, dungeon runs
// and the leaderboard, and refresh the readiness board.
export async function followUpImport(discordGuild: DiscordGuild | null, guildId: string, result: ImportResult): Promise<{ autoLinked: { character: string; member: string }[] }> {
  const autoLinked = discordGuild && result.discovery.discovered > 0
    ? await autoLinkUnclaimed(discordGuild, prisma, guildId).catch(() => [])
    : [];
  const matchedRaids = result.raids.filter((raid) => raid.matchedRaidTitle).length;
  if (result.epgpTransactions.length > 0 || matchedRaids > 0) {
    await notify(discordGuild, notifications.importApplied(result.epgpTransactions.length, matchedRaids));
  }
  const dungeonPost = dungeonAnnouncement(result.dungeons, "en");
  if (dungeonPost) {
    await notifyDungeon(discordGuild, (lang) => dungeonAnnouncement(result.dungeons, lang) ?? dungeonPost);
    await updateDungeonLeaderboard(discordGuild);
  }
  if (result.readinessSnapshots.length > 0 || result.consumables > 0) await postReadinessBoard(discordGuild, guildId, "updated after an addon import");
  return { autoLinked };
}
