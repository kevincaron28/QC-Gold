import { EmbedBuilder, type Guild as DiscordGuild } from "discord.js";
import { prisma } from "../database.js";
import { asLang, t } from "../i18n.js";
import { activeSeasonOrNull, formatLeaderboard, leaderboard } from "./dungeon-stats.js";
import { createGuildService } from "./guild.js";

const guildService = createGuildService(prisma);

// One leaderboard message in the dungeon leaderboard channel, edited in
// place after every dungeon import so the channel always shows the standings.
// If the message was deleted, a new one is posted and remembered.
// Never throws: a failed refresh must not undo the import it follows.
export async function updateDungeonLeaderboard(discordGuild: DiscordGuild | null): Promise<boolean> {
  if (!discordGuild) return false;
  try {
    const guild = await guildService.ensureGuild(discordGuild.id, discordGuild.name);
    const settings = await guildService.getSettings(guild.id);
    if (!settings?.dungeonLeaderboardChannelId) return false;
    const channel = await discordGuild.channels.fetch(settings.dungeonLeaderboardChannelId).catch(() => null);
    if (!channel?.isTextBased()) return false;

    const lang = asLang(settings.language);
    const season = await activeSeasonOrNull(prisma, guild.id);
    const rows = await leaderboard(prisma, guild.id, "season", null);
    const embed = new EmbedBuilder()
      .setColor(0xd4a017)
      .setTitle(t(lang, "dungeon.board.season", { season: season?.name ?? "Season 1" }))
      .setDescription(rows.length ? formatLeaderboard(rows) : t(lang, "dungeon.board.empty"))
      .setTimestamp(new Date());
    const payload = { embeds: [embed], allowedMentions: { parse: [] as never[] } };

    const existing = settings.dungeonLeaderboardMessageId
      ? await channel.messages.fetch(settings.dungeonLeaderboardMessageId).catch(() => null)
      : null;
    if (existing?.editable) {
      await existing.edit(payload);
    } else {
      const sent = await channel.send(payload);
      await guildService.updateSettings(guild.id, { dungeonLeaderboardMessageId: sent.id });
    }
    return true;
  } catch (error) {
    console.error("Failed to update dungeon leaderboard", error);
    return false;
  }
}
