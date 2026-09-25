import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction, type Client } from "discord.js";
import { prisma } from "../database.js";
import { guildStats, isWeeklyReportDue, type GuildStats } from "../services/guild-stats.js";
import { asLang, t, type Lang } from "../i18n.js";
import { guildService, requireGuildContext } from "./context.js";

export const statsCommand = new SlashCommandBuilder()
  .setName("stats")
  .setDescription("Guild activity: raids, boss kills, loot, EP, recruitment, top attendance.")
  .addIntegerOption((o) => o.setName("days").setDescription("How far back (default 7)").setMinValue(1).setMaxValue(365));

export function statsEmbed(stats: GuildStats, title: string, lang: Lang = "en"): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(t(lang, "stats.since", { date: `<t:${Math.floor(stats.since.getTime() / 1000)}:D>` }))
    .addFields(
      { name: t(lang, "stats.raids"), value: t(lang, "stats.raidsValue", { count: stats.raids, avg: stats.averageRaiders }), inline: true },
      { name: t(lang, "stats.kills"), value: String(stats.bossKills), inline: true },
      { name: t(lang, "stats.ep"), value: String(stats.epAwarded), inline: true },
      { name: t(lang, "stats.loot"), value: `${stats.lootCount} item(s), ${stats.gpSpent} GP`, inline: true },
      { name: t(lang, "stats.newMembers"), value: String(stats.newMembers), inline: true },
      { name: t(lang, "stats.applications"), value: String(stats.applications), inline: true }
    );
  if (stats.topAttendance.length) {
    embed.addFields({ name: t(lang, "stats.mostRaids"), value: stats.topAttendance.map((row) => `${row.name} (${row.raids})`).join(", ").slice(0, 1000) });
  }
  if (stats.topLoot.length) {
    embed.addFields({ name: t(lang, "stats.mostLoot"), value: stats.topLoot.map((row) => `${row.name}: ${row.items} item(s), ${row.gp} GP`).join("\n").slice(0, 1000) });
  }
  return embed;
}

export async function executeStats(interaction: ChatInputCommandInteraction): Promise<void> {
  const context = await requireGuildContext(interaction);
  if (!context) return;
  const days = interaction.options.getInteger("days") ?? 7;
  const stats = await guildStats(prisma, context.guildId, new Date(Date.now() - days * 86_400_000));
  const lang = asLang((await guildService.getSettings(context.guildId))?.language);
  await interaction.reply({ embeds: [statsEmbed(stats, t(lang, "stats.titleDays", { days }), lang)], allowedMentions: { parse: [] } });
}

// Called hourly from main.ts: posts the weekly report to the notify channel
// for guilds that turned it on (/config weekly-report). Marks the guild
// first so a failed post can't repeat every hour.
export async function runWeeklyReports(client: Client, now = new Date()): Promise<number> {
  const configured = await prisma.guildSettings.findMany({
    where: { weeklyReportEnabled: true, notifyChannelId: { not: null } },
    include: { guild: true }
  });
  let posted = 0;
  for (const settings of configured) {
    if (!isWeeklyReportDue({ enabled: settings.weeklyReportEnabled, lastAt: settings.weeklyReportLastAt, now })) continue;
    await prisma.guildSettings.update({ where: { id: settings.id }, data: { weeklyReportLastAt: now } });
    try {
      const stats = await guildStats(prisma, settings.guildId, new Date(now.getTime() - 7 * 86_400_000));
      const discordGuild = await client.guilds.fetch(settings.guild.discordId);
      const channel = await discordGuild.channels.fetch(settings.notifyChannelId ?? "");
      if (!channel?.isTextBased()) continue;
      const lang = asLang(settings.language);
      await channel.send({ embeds: [statsEmbed(stats, t(lang, "stats.titleWeekly"), lang)], allowedMentions: { parse: [] } });
      posted += 1;
    } catch (error) {
      console.error(`Weekly report failed for guild ${settings.guild.discordId}`, error);
    }
  }
  return posted;
}
