import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction, type Client } from "discord.js";
import { prisma } from "../database.js";
import { guildStats, isWeeklyReportDue, type GuildStats } from "../services/guild-stats.js";
import { requireGuildContext } from "./context.js";

export const statsCommand = new SlashCommandBuilder()
  .setName("stats")
  .setDescription("Guild activity: raids, boss kills, loot, EP, recruitment, top attendance.")
  .addIntegerOption((o) => o.setName("days").setDescription("How far back (default 7)").setMinValue(1).setMaxValue(365));

export function statsEmbed(stats: GuildStats, title: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(`Since <t:${Math.floor(stats.since.getTime() / 1000)}:D>`)
    .addFields(
      { name: "⚔️ Raids", value: `${stats.raids} (avg ${stats.averageRaiders} raiders)`, inline: true },
      { name: "💀 Boss kills", value: String(stats.bossKills), inline: true },
      { name: "💰 EP awarded", value: String(stats.epAwarded), inline: true },
      { name: "🎁 Loot", value: `${stats.lootCount} item(s), ${stats.gpSpent} GP`, inline: true },
      { name: "👋 New members", value: String(stats.newMembers), inline: true },
      { name: "📝 Applications", value: String(stats.applications), inline: true }
    );
  if (stats.topAttendance.length) {
    embed.addFields({ name: "Most raids attended", value: stats.topAttendance.map((row) => `${row.name} (${row.raids})`).join(", ").slice(0, 1000) });
  }
  if (stats.topLoot.length) {
    embed.addFields({ name: "Most loot", value: stats.topLoot.map((row) => `${row.name}: ${row.items} item(s), ${row.gp} GP`).join("\n").slice(0, 1000) });
  }
  return embed;
}

export async function executeStats(interaction: ChatInputCommandInteraction): Promise<void> {
  const context = await requireGuildContext(interaction);
  if (!context) return;
  const days = interaction.options.getInteger("days") ?? 7;
  const stats = await guildStats(prisma, context.guildId, new Date(Date.now() - days * 86_400_000));
  await interaction.reply({ embeds: [statsEmbed(stats, `⚜️ Quebec Gold — last ${days} day${days === 1 ? "" : "s"}`)], allowedMentions: { parse: [] } });
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
      await channel.send({ embeds: [statsEmbed(stats, "⚜️ Quebec Gold — weekly report")], allowedMentions: { parse: [] } });
      posted += 1;
    } catch (error) {
      console.error(`Weekly report failed for guild ${settings.guild.discordId}`, error);
    }
  }
  return posted;
}
