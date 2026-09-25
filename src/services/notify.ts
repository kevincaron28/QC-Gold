import type { EmbedBuilder, Guild as DiscordGuild } from "discord.js";
import { prisma } from "../database.js";
import { asLang, t, type Lang } from "../i18n.js";
import { createGuildService } from "./guild.js";

const guildService = createGuildService(prisma);

// Text that's rendered in the guild's language when it's posted.
export type Localized<T = string> = (lang: Lang) => T;

async function notifyTarget(discordGuild: DiscordGuild) {
  const guild = await guildService.ensureGuild(discordGuild.id, discordGuild.name);
  const settings = await guildService.getSettings(guild.id);
  if (!settings?.notifyChannelId) return null;
  const channel = await discordGuild.channels.fetch(settings.notifyChannelId).catch(() => null);
  if (!channel?.isTextBased()) return null;
  return { channel, lang: asLang(settings.language) };
}

// Raid/boss/loot/EPGP announcements for the whole guild, posted to the
// channel set with /config notify-channel. One line per event (batched
// commands post one line, not one per player). Never pings anyone and never
// throws: a failed announcement must not undo the action it describes.
export async function notify(discordGuild: DiscordGuild | null, content: string | Localized): Promise<void> {
  if (!discordGuild) return;
  try {
    const target = await notifyTarget(discordGuild);
    if (!target) return;
    const text = typeof content === "string" ? content : content(target.lang);
    await target.channel.send({ content: text.slice(0, 1900), allowedMentions: { parse: [] } });
  } catch (error) {
    console.error("Failed to post notification", error);
  }
}

// Same channel and rules as notify(), for richer posts like the raid report.
export async function notifyEmbed(discordGuild: DiscordGuild | null, embed: EmbedBuilder | Localized<EmbedBuilder>): Promise<boolean> {
  if (!discordGuild) return false;
  try {
    const target = await notifyTarget(discordGuild);
    if (!target) return false;
    await target.channel.send({ embeds: [typeof embed === "function" ? embed(target.lang) : embed], allowedMentions: { parse: [] } });
    return true;
  } catch (error) {
    console.error("Failed to post notification embed", error);
    return false;
  }
}

const signed = (value: number) => `${value >= 0 ? "+" : ""}${value}`;

export const notifications = {
  raidStarted: (raid: string): Localized => (lang) => t(lang, "notify.raidStarted", { raid }),
  raidEnded: (raid: string): Localized => (lang) => t(lang, "notify.raidEnded", { raid }),
  bossKilled: (boss: string, raid: string): Localized => (lang) => t(lang, "notify.bossKilled", { boss, raid }),
  lootAwarded: (item: string, winner: string, gp: number): Localized => (lang) => t(lang, "notify.loot", { item, winner, gp }),
  epgpChanged: (who: string, ep: number, gp: number, reason: string): Localized => (lang) => t(lang, "notify.epgp", {
    who, reason,
    change: `${ep ? `${signed(ep)} EP` : ""}${ep && gp ? ", " : ""}${gp ? `${signed(gp)} GP` : ""}`
  }),
  decayApplied: (percent: number, count: number): Localized => (lang) => t(lang, "notify.decay", { percent, count }),
  importApplied: (count: number, raids: number): Localized => (lang) => {
    const text = t(lang, "notify.import", { count, raids: raids ? t(lang, "notify.importRaids", { count: raids }) : "" });
    return lang === "en" && count === 1 ? text.replace("1 EPGP entries", "1 EPGP entry") : text;
  },
  epAwarded: (raid: string, count: number, total: number): Localized => (lang) => t(lang, "notify.epAwarded", { raid, count, total })
};
