import type { Guild as DiscordGuild, GuildMember, PartialGuildMember } from "discord.js";
import { prisma } from "../database.js";
import { createGuildService } from "./guild.js";

const guildService = createGuildService(prisma);

export const DEFAULT_WELCOME_TEMPLATE =
  "Welcome to {guild}, {mention}! Run `/apply` to submit a recruitment application, "
  + "or `/character add` to link a character if you're already a member.";
export const DEFAULT_FAREWELL_TEMPLATE = "{username} has left {guild}. o7";

interface TemplateVars {
  mention: string;
  username: string;
  guildName: string;
  memberCount: number;
}

export function renderTemplate(template: string, vars: TemplateVars): string {
  return template
    .replace(/\{mention\}/g, vars.mention)
    .replace(/\{username\}/g, vars.username)
    .replace(/\{guild\}/g, vars.guildName)
    .replace(/\{membercount\}/g, String(vars.memberCount));
}

// Posts a plain-text line to the configured log channel, if any. Never pings
// anyone and never throws: logging must not be able to break the action that
// triggered it.
export async function postToLogChannel(discordGuild: DiscordGuild, content: string): Promise<void> {
  try {
    const guild = await guildService.ensureGuild(discordGuild.id, discordGuild.name);
    const settings = await guildService.getSettings(guild.id);
    if (!settings?.logChannelId) return;
    const channel = await discordGuild.channels.fetch(settings.logChannelId).catch(() => null);
    if (!channel?.isTextBased()) return;
    await channel.send({ content, allowedMentions: { parse: [] } });
  } catch (error) {
    console.error("Failed to post to log channel", error);
  }
}

export async function handleMemberJoin(discordGuild: DiscordGuild, member: GuildMember): Promise<void> {
  const guild = await guildService.ensureGuild(discordGuild.id, discordGuild.name);
  const settings = await guildService.getSettings(guild.id);
  if (!settings) return;
  await postToLogChannel(discordGuild, `Member joined: ${member.user.tag} (${member.id})`);

  if (settings.applicantRoleId) {
    await member.roles.add(settings.applicantRoleId).catch((error: unknown) => {
      console.error(`Failed to assign applicant role to ${member.id}`, error);
    });
  }

  if (settings.welcomeChannelId) {
    const channel = await discordGuild.channels.fetch(settings.welcomeChannelId).catch(() => null);
    if (channel?.isTextBased()) {
      const text = renderTemplate(settings.welcomeMessageTemplate ?? DEFAULT_WELCOME_TEMPLATE, {
        mention: `<@${member.id}>`,
        username: member.user.username,
        guildName: discordGuild.name,
        memberCount: discordGuild.memberCount
      });
      await channel.send(text).catch((error: unknown) => console.error("Failed to send welcome message", error));
    }
  }
}

export async function handleMemberLeave(discordGuild: DiscordGuild, member: GuildMember | PartialGuildMember): Promise<void> {
  const guild = await guildService.ensureGuild(discordGuild.id, discordGuild.name);
  const settings = await guildService.getSettings(guild.id);
  const username = member.user?.username ?? "A member";
  await postToLogChannel(discordGuild, `Member left: ${member.user?.tag ?? username} (${member.id})`);
  if (!settings?.farewellChannelId) return;

  const channel = await discordGuild.channels.fetch(settings.farewellChannelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const text = renderTemplate(settings.farewellMessageTemplate ?? DEFAULT_FAREWELL_TEMPLATE, {
    mention: username,
    username,
    guildName: discordGuild.name,
    memberCount: discordGuild.memberCount
  });
  await channel.send(text).catch((error: unknown) => console.error("Failed to send farewell message", error));
}

export async function syncApprovedMemberRoles(discordGuild: DiscordGuild, guildId: string, discordUserId: string): Promise<void> {
  const settings = await guildService.getSettings(guildId);
  if (!settings) return;
  const member = await discordGuild.members.fetch(discordUserId).catch(() => null);
  if (!member) return;

  if (settings.memberRoleId) {
    await member.roles.add(settings.memberRoleId).catch((error: unknown) => {
      console.error(`Failed to add member role to ${discordUserId}`, error);
    });
  }
  if (settings.applicantRoleId) {
    await member.roles.remove(settings.applicantRoleId).catch((error: unknown) => {
      console.error(`Failed to remove applicant role from ${discordUserId}`, error);
    });
  }
}
