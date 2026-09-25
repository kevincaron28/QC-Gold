import { EmbedBuilder, type Guild as DiscordGuild } from "discord.js";
import type { PrismaClient, RaidRole } from "@prisma/client";
import { createGuildService } from "./guild.js";

// A raid core is a named roster (e.g. "Tuesday MC core"). A guild can have
// several. Core members get priority at signups for raids created for that
// core (see raid.ts), and every core's roster is kept as one live message in
// the roster channel.

const ROLE_ORDER: RaidRole[] = ["TANK", "HEALER", "DPS"];
const ROLE_LABEL: Record<RaidRole, string> = { TANK: "🛡️ Tanks", HEALER: "💚 Healers", DPS: "⚔️ DPS" };

type Db = PrismaClient;

export function createRaidCoreService(database: Db) {
  async function byIdOrName(guildId: string, value: string) {
    const core = await database.raidCore.findFirst({
      where: { guildId, OR: [{ id: value }, { name: { equals: value.trim(), mode: "insensitive" } }] },
      include: { members: { include: { member: true }, orderBy: { addedAt: "asc" } } }
    });
    if (!core) throw new Error(`No raid core "${value}". See /core list.`);
    return core;
  }

  return {
    byIdOrName,

    async create(guildId: string, name: string, description?: string | null) {
      const clean = name.trim();
      if (clean.length < 2 || clean.length > 50) throw new Error("A core name must be 2 to 50 characters.");
      const exists = await database.raidCore.findFirst({ where: { guildId, name: { equals: clean, mode: "insensitive" } } });
      if (exists) throw new Error(`A core called "${exists.name}" already exists.`);
      return database.raidCore.create({ data: { guildId, name: clean, description: description?.trim().slice(0, 300) || null } });
    },

    async remove(guildId: string, value: string) {
      const core = await byIdOrName(guildId, value);
      await database.raidCore.delete({ where: { id: core.id } });
      return core;
    },

    async addMember(guildId: string, value: string, memberId: string, role: RaidRole) {
      const core = await byIdOrName(guildId, value);
      await database.raidCoreMember.upsert({
        where: { coreId_memberId: { coreId: core.id, memberId } },
        create: { coreId: core.id, memberId, role },
        update: { role }
      });
      return core;
    },

    async removeMember(guildId: string, value: string, memberId: string) {
      const core = await byIdOrName(guildId, value);
      const removed = await database.raidCoreMember.deleteMany({ where: { coreId: core.id, memberId } });
      if (removed.count === 0) throw new Error("That player is not in this core.");
      return core;
    },

    list(guildId: string) {
      return database.raidCore.findMany({
        where: { guildId },
        include: { members: { include: { member: true }, orderBy: { addedAt: "asc" } }, _count: { select: { raids: true } } },
        orderBy: { name: "asc" }
      });
    },

    async memberIds(coreId: string): Promise<Set<string>> {
      const rows = await database.raidCoreMember.findMany({ where: { coreId }, select: { memberId: true } });
      return new Set(rows.map((row) => row.memberId));
    }
  };
}

type CoreForEmbed = {
  name: string;
  description: string | null;
  members: { role: RaidRole; member: { displayName: string } }[];
};

export function coreRosterEmbed(core: CoreForEmbed): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(0xd4af37).setTitle(`⚜️ ${core.name}`);
  if (core.description) embed.setDescription(core.description);
  for (const role of ROLE_ORDER) {
    const names = core.members.filter((entry) => entry.role === role).map((entry) => entry.member.displayName).sort((a, b) => a.localeCompare(b));
    embed.addFields({ name: `${ROLE_LABEL[role]} (${names.length})`, value: names.length ? names.join("\n").slice(0, 1000) : "—", inline: true });
  }
  embed.setFooter({ text: `${core.members.length} core member${core.members.length === 1 ? "" : "s"} · priority at this core's raid signups` });
  return embed;
}

// Keeps the core's roster message in the roster channel current (edit in
// place; re-post if it was deleted). False when no roster channel is set.
// Never throws: a failed refresh must not undo the change that caused it.
export async function syncCoreRoster(discordGuild: DiscordGuild | null, database: Db, guildId: string, coreId: string): Promise<boolean> {
  if (!discordGuild) return false;
  try {
    const settings = await createGuildService(database).getSettings(guildId);
    if (!settings?.coreChannelId) return false;
    const channel = await discordGuild.channels.fetch(settings.coreChannelId).catch(() => null);
    if (!channel?.isTextBased()) return false;
    const core = await database.raidCore.findFirst({ where: { id: coreId, guildId }, include: { members: { include: { member: true } } } });
    if (!core) return false;
    const payload = { embeds: [coreRosterEmbed(core)], allowedMentions: { parse: [] as never[] } };
    const existing = core.rosterMessageId ? await channel.messages.fetch(core.rosterMessageId).catch(() => null) : null;
    if (existing?.editable) {
      await existing.edit(payload);
    } else {
      const sent = await channel.send(payload);
      await database.raidCore.update({ where: { id: core.id }, data: { rosterMessageId: sent.id } });
    }
    return true;
  } catch (error) {
    console.error("Failed to sync core roster", error);
    return false;
  }
}

// Removes a deleted core's roster message from the channel.
export async function removeCoreRosterMessage(discordGuild: DiscordGuild | null, database: Db, guildId: string, messageId: string | null): Promise<void> {
  if (!discordGuild || !messageId) return;
  try {
    const settings = await createGuildService(database).getSettings(guildId);
    if (!settings?.coreChannelId) return;
    const channel = await discordGuild.channels.fetch(settings.coreChannelId).catch(() => null);
    if (!channel?.isTextBased()) return;
    const message = await channel.messages.fetch(messageId).catch(() => null);
    await message?.delete().catch(() => undefined);
  } catch (error) {
    console.error("Failed to remove core roster message", error);
  }
}

// Reposts every core's roster (used when the roster channel is first set).
export async function syncAllCoreRosters(discordGuild: DiscordGuild | null, database: Db, guildId: string): Promise<void> {
  const cores = await database.raidCore.findMany({ where: { guildId }, select: { id: true } });
  for (const core of cores) await syncCoreRoster(discordGuild, database, guildId, core.id);
}
