import { EmbedBuilder, type Guild as DiscordGuild } from "discord.js";
import { prisma } from "../database.js";
import { notifyEmbed } from "../services/notify.js";
import { buildRaidReport, formatDuration, type RaidReport } from "../services/raid-report.js";

export function raidReportEmbed(report: RaidReport): EmbedBuilder {
  const bosses = report.bossesPlanned > 0
    ? `${report.bossesKilled}/${report.bossesPlanned}${report.killedNames.length ? `\n${report.killedNames.join(", ")}` : ""}`
    : report.killedNames.length ? report.killedNames.join(", ") : "none recorded";
  const embed = new EmbedBuilder()
    .setTitle(`⚜️ Quebec Gold — ${report.title}`)
    .setDescription(report.endedAt ? "Raid completed" : "Raid in progress")
    .addFields(
      { name: "🕐 Duration", value: formatDuration(report.durationMinutes), inline: true },
      { name: "👥 Raiders", value: `${report.raiders}${report.late ? ` (${report.late} late)` : ""}`, inline: true },
      { name: "🏆 Bosses killed", value: bosses.slice(0, 1000), inline: true },
      {
        name: "💰 EPGP",
        value: report.epRecipients ? `+${report.epAwarded} EP to ${report.epRecipients} raider(s)` : "EP not approved yet",
        inline: true
      },
      { name: "🎁 Loot", value: report.lootCount ? `${report.lootCount} item(s), ${report.gpSpent} GP spent` : "none recorded", inline: true }
    );
  if (report.topLoot.length) {
    embed.addFields({
      name: "Top items",
      value: report.topLoot.map((loot) => `${loot.item} → ${loot.winner} (${loot.gp} GP)`).join("\n").slice(0, 1000)
    });
  }
  if (report.endedAt) embed.setTimestamp(report.endedAt);
  return embed;
}

// Posts the report to the announcements channel. Returns false when no
// channel is configured (callers then show it to the officer instead).
export async function postRaidReport(discordGuild: DiscordGuild | null, guildId: string, raidId: string): Promise<boolean> {
  const report = await buildRaidReport(prisma, guildId, raidId);
  return notifyEmbed(discordGuild, raidReportEmbed(report));
}
