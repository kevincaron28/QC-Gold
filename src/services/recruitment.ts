import type { Client } from "discord.js";
import type { PrismaClient } from "@prisma/client";

export function isRecruitmentDue(input: { now: Date; lastPostedAt: Date | null; intervalHours: number | null }): boolean {
  if (!input.intervalHours || input.intervalHours <= 0) return false;
  if (!input.lastPostedAt) return true;
  return input.now.getTime() - input.lastPostedAt.getTime() >= input.intervalHours * 3_600_000;
}

// Called on a timer from main.ts. Only runs while the bot process is up, so a
// missed window just posts on the next check rather than queueing up.
export async function runRecruitmentPosts(client: Client, database: PrismaClient, now = new Date()): Promise<number> {
  const configured = await database.guildSettings.findMany({
    where: { recruitmentChannelId: { not: null }, recruitmentMessage: { not: null }, recruitmentIntervalHours: { not: null } },
    include: { guild: true }
  });
  let posted = 0;
  for (const settings of configured) {
    if (!settings.recruitmentChannelId || !settings.recruitmentMessage) continue;
    if (!isRecruitmentDue({ now, lastPostedAt: settings.recruitmentLastPostedAt, intervalHours: settings.recruitmentIntervalHours })) continue;
    try {
      const discordGuild = await client.guilds.fetch(settings.guild.discordId);
      const channel = await discordGuild.channels.fetch(settings.recruitmentChannelId);
      if (!channel?.isTextBased()) continue;
      await channel.send({ content: settings.recruitmentMessage, allowedMentions: { parse: [] } });
      await database.guildSettings.update({ where: { id: settings.id }, data: { recruitmentLastPostedAt: now } });
      posted += 1;
    } catch (error) {
      console.error(`Recruitment post failed for guild ${settings.guild.discordId}`, error);
    }
  }
  return posted;
}
