import type { EmbedBuilder, Guild as DiscordGuild } from "discord.js";
import { prisma } from "../database.js";
import { createGuildService } from "./guild.js";

const guildService = createGuildService(prisma);

// Raid/boss/loot/EPGP announcements for the whole guild, posted to the
// channel set with /config notify-channel. One line per event (batched
// commands post one line, not one per player). Never pings anyone and never
// throws: a failed announcement must not undo the action it describes.
export async function notify(discordGuild: DiscordGuild | null, content: string): Promise<void> {
  if (!discordGuild) return;
  try {
    const guild = await guildService.ensureGuild(discordGuild.id, discordGuild.name);
    const settings = await guildService.getSettings(guild.id);
    if (!settings?.notifyChannelId) return;
    const channel = await discordGuild.channels.fetch(settings.notifyChannelId).catch(() => null);
    if (!channel?.isTextBased()) return;
    await channel.send({ content: content.slice(0, 1900), allowedMentions: { parse: [] } });
  } catch (error) {
    console.error("Failed to post notification", error);
  }
}

// Same channel and rules as notify(), for richer posts like the raid report.
export async function notifyEmbed(discordGuild: DiscordGuild | null, embed: EmbedBuilder): Promise<boolean> {
  if (!discordGuild) return false;
  try {
    const guild = await guildService.ensureGuild(discordGuild.id, discordGuild.name);
    const settings = await guildService.getSettings(guild.id);
    if (!settings?.notifyChannelId) return false;
    const channel = await discordGuild.channels.fetch(settings.notifyChannelId).catch(() => null);
    if (!channel?.isTextBased()) return false;
    await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
    return true;
  } catch (error) {
    console.error("Failed to post notification embed", error);
    return false;
  }
}

const signed = (value: number) => `${value >= 0 ? "+" : ""}${value}`;

export const notifications = {
  raidStarted: (title: string) => `⚔️ Raid started: **${title}**`,
  raidEnded: (title: string) => `🏁 Raid ended: **${title}**`,
  bossKilled: (boss: string, raid: string) => `💀 **${boss}** killed (${raid})`,
  lootAwarded: (item: string, winner: string, gp: number) => `🎁 **${item}** → ${winner} for **${gp} GP**`,
  epgpChanged: (who: string, ep: number, gp: number, reason: string) =>
    `💰 ${who}: ${ep ? `${signed(ep)} EP` : ""}${ep && gp ? ", " : ""}${gp ? `${signed(gp)} GP` : ""} (${reason})`,
  decayApplied: (percent: number, members: number) => `📉 EPGP decay of ${percent}% applied to ${members} member(s)`,
  importApplied: (epgpCount: number, raids: number) =>
    `📥 Addon import applied: ${epgpCount} EPGP entr${epgpCount === 1 ? "y" : "ies"}${raids ? `, attendance for ${raids} raid(s)` : ""}`
};
