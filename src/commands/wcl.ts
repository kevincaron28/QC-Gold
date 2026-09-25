import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction, type GuildMember } from "discord.js";
import { config } from "../config.js";
import { prisma } from "../database.js";
import { createWclClient, parseReportRef } from "../integrations/warcraftlogs.js";
import { hasPermission } from "../permissions.js";
import { notifyEmbed } from "../services/notify.js";
import { reportUrl, saveReport, summarizeReport, type WclSummary } from "../services/wcl.js";
import { requireGuildContext } from "./context.js";

export const wclCommand = new SlashCommandBuilder()
  .setName("wcl")
  .setDescription("Warcraft Logs: pull a raid log into the guild's raid history.")
  .addSubcommand((sub) => sub.setName("report").setDescription("Pull a Warcraft Logs report and post a summary (officers).")
    .addStringOption((o) => o.setName("url").setDescription("Report link or code").setRequired(true))
    .addStringOption((o) => o.setName("raid").setDescription("Link it to a Discord raid (raid id from /raid status)"))
    .addBooleanOption((o) => o.setName("post").setDescription("Also post it in the raid logs channel (default: yes)")))
  .addSubcommand((sub) => sub.setName("list").setDescription("The most recent Warcraft Logs reports pulled in."));

export function wclEmbed(title: string, url: string, zone: string | null, summary: WclSummary, raidTitle?: string): EmbedBuilder {
  const bossLines = summary.bosses.map((boss) =>
    `${boss.kills > 0 ? "✅" : "❌"} **${boss.name}**${boss.wipes ? ` — ${boss.wipes} wipe${boss.wipes === 1 ? "" : "s"}` : ""}${boss.bestKillSec !== null ? ` · ${Math.floor(boss.bestKillSec / 60)}:${String(boss.bestKillSec % 60).padStart(2, "0")}` : ""}`);
  const embed = new EmbedBuilder()
    .setColor(0xf5a623)
    .setTitle(`📜 ${title}`.slice(0, 250))
    .setURL(url)
    .setDescription(bossLines.length ? bossLines.join("\n").slice(0, 3900) : "No boss fights in this log.")
    .addFields(
      { name: "Zone", value: zone ?? "Unknown", inline: true },
      { name: "Duration", value: `${Math.floor(summary.durationMinutes / 60)}h ${summary.durationMinutes % 60}m`, inline: true },
      { name: "Bosses", value: `${summary.bossesKilled}/${summary.bosses.length} killed · ${summary.totalWipes} wipe${summary.totalWipes === 1 ? "" : "s"}`, inline: true },
      { name: "Players", value: String(summary.players.length), inline: true }
    )
    .setFooter({ text: raidTitle ? `Linked to raid: ${raidTitle}` : "Warcraft Logs" });
  return embed;
}

export async function executeWcl(interaction: ChatInputCommandInteraction): Promise<void> {
  const context = await requireGuildContext(interaction);
  if (!context) return;
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "list") {
    const rows = await prisma.warcraftLogsReport.findMany({ where: { guildId: context.guildId }, orderBy: { startedAt: "desc" }, take: 10 });
    await interaction.reply({
      content: rows.length
        ? rows.map((row) => `• [${row.title}](${row.url}) — ${row.zone ?? "?"} · <t:${Math.floor(row.startedAt.getTime() / 1000)}:d>`).join("\n")
        : "No Warcraft Logs reports pulled in yet. Officers: `/wcl report url:<link>`.",
      ephemeral: true
    });
    return;
  }

  if (!interaction.member || !hasPermission(interaction.member as GuildMember, "officer")) {
    await interaction.reply({ content: "Only Officers and Guild Masters can pull Warcraft Logs reports.", ephemeral: true });
    return;
  }
  if (!config.WCL_CLIENT_ID || !config.WCL_CLIENT_SECRET) {
    await interaction.reply({
      content: "Warcraft Logs isn't set up yet. Create an API client at https://www.warcraftlogs.com/api/clients, put `WCL_CLIENT_ID` and `WCL_CLIENT_SECRET` in `.env.local`, and restart the bot.",
      ephemeral: true
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const ref = parseReportRef(interaction.options.getString("url", true), config.WCL_BASE_URL);
  const raidId = interaction.options.getString("raid");
  const raid = raidId ? await prisma.raid.findFirst({ where: { id: raidId, guildId: context.guildId }, select: { id: true, title: true } }) : null;
  if (raidId && !raid) throw new Error("No raid with that id in this guild (see /raid status for ids).");

  const client = createWclClient({ clientId: config.WCL_CLIENT_ID, clientSecret: config.WCL_CLIENT_SECRET });
  const report = await client.fetchReport(ref);
  const { summary } = await saveReport(prisma, { guildId: context.guildId, report, baseUrl: ref.baseUrl, raidId: raid?.id ?? null, createdBy: interaction.user.id });
  const embed = wclEmbed(report.title, reportUrl(ref.baseUrl, report.code), report.zone?.name ?? null, summary, raid?.title);

  const wantsPost = interaction.options.getBoolean("post") ?? true;
  const posted = wantsPost ? await notifyEmbed(interaction.guild, embed, "raidLog") : false;
  await interaction.editReply({
    content: wantsPost && !posted ? "Saved. (No raid logs or announcements channel is set, so nothing was posted.)" : posted ? "Saved and posted in the raid logs channel." : "Saved.",
    embeds: [embed]
  });
}

export { summarizeReport };
