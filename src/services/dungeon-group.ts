import type { PrismaClient, RaidRole } from "@prisma/client";

// Dungeon groups: a 5-player signup (1 tank, 1 healer, 3 DPS) with a
// temporary voice channel once the group is ready. This file is the rules
// (who is in, who waits); the Discord side is commands/dungeon-group.ts.

export const GROUP_CAPS: Record<RaidRole, number> = { TANK: 1, HEALER: 1, DPS: 3 };
export const GROUP_SIZE = 5;

// How long an empty group voice channel is kept before it is deleted, and
// how long an unfinished signup stays open.
export const VOICE_EMPTY_MINUTES = 5;
export const OPEN_GROUP_HOURS = 24;

type Db = PrismaClient;

export function createDungeonGroupService(database: Db) {
  async function getOpen(groupId: string, guildId: string) {
    const group = await database.dungeonGroup.findFirst({ where: { id: groupId, guildId } });
    if (!group) throw new Error("That dungeon group no longer exists.");
    if (group.status === "CLOSED") throw new Error("That dungeon group is closed.");
    return group;
  }

  return {
    create(input: { guildId: string; title: string; leaderId: string; channelId: string | null }) {
      const title = input.title.trim();
      if (title.length < 3 || title.length > 80) throw new Error("A group title must be 3 to 80 characters.");
      return database.dungeonGroup.create({
        data: { guildId: input.guildId, title, leaderId: input.leaderId, signupChannelId: input.channelId }
      });
    },

    setMessage(groupId: string, channelId: string, messageId: string) {
      return database.dungeonGroup.update({ where: { id: groupId }, data: { signupChannelId: channelId, signupMessageId: messageId } });
    },

    // Signs up in `role`, or waitlists when that role is full. Signing up again
    // changes role. Returns the new state of the player.
    async join(groupId: string, guildId: string, memberId: string, role: RaidRole) {
      const group = await getOpen(groupId, guildId);
      const taken = await database.dungeonGroupSignup.count({
        where: { groupId, role, status: "SIGNED_UP", memberId: { not: memberId } }
      });
      const status = taken >= GROUP_CAPS[role] ? "WAITLISTED" : "SIGNED_UP";
      const found = await database.dungeonGroupSignup.findUnique({ where: { groupId_memberId: { groupId, memberId } } });
      const previous = found ? { role: found.role, status: found.status } : null;
      const saved = await database.dungeonGroupSignup.upsert({
        where: { groupId_memberId: { groupId, memberId } },
        create: { groupId, memberId, role, status },
        update: { role, status, joinedAt: new Date() }
      });
      // Moving away from a full role opens its slot for the waitlist.
      const promoted = previous && previous.status === "SIGNED_UP" && previous.role !== role ? await promoteWaitlist(groupId, previous.role) : [];
      return { group, signup: saved, promoted };
    },

    async leave(groupId: string, guildId: string, memberId: string) {
      await getOpen(groupId, guildId);
      const existing = await database.dungeonGroupSignup.findUnique({ where: { groupId_memberId: { groupId, memberId } } });
      if (!existing) throw new Error("You are not in this group.");
      await database.dungeonGroupSignup.delete({ where: { id: existing.id } });
      const promoted = existing.status === "SIGNED_UP" ? await promoteWaitlist(groupId, existing.role) : [];
      return { removed: existing, promoted };
    },

    async members(groupId: string) {
      return database.dungeonGroupSignup.findMany({ where: { groupId }, include: { member: true }, orderBy: { joinedAt: "asc" } });
    },

    async isFull(groupId: string): Promise<boolean> {
      return (await database.dungeonGroupSignup.count({ where: { groupId, status: "SIGNED_UP" } })) >= GROUP_SIZE;
    },

    async markStarted(groupId: string, voiceChannelId: string | null) {
      return database.dungeonGroup.update({ where: { id: groupId }, data: { status: "STARTED", startedAt: new Date(), voiceChannelId } });
    },

    async close(groupId: string) {
      return database.dungeonGroup.update({ where: { id: groupId }, data: { status: "CLOSED", closedAt: new Date(), voiceChannelId: null } });
    }
  };

  // Fills open slots of `role` from the waitlist, longest waiting first.
  async function promoteWaitlist(groupId: string, role: RaidRole) {
    const taken = await database.dungeonGroupSignup.count({ where: { groupId, role, status: "SIGNED_UP" } });
    const open = GROUP_CAPS[role] - taken;
    if (open <= 0) return [];
    const waiting = await database.dungeonGroupSignup.findMany({
      where: { groupId, role, status: "WAITLISTED" }, include: { member: true }, orderBy: { joinedAt: "asc" }, take: open
    });
    for (const signup of waiting) {
      await database.dungeonGroupSignup.update({ where: { id: signup.id }, data: { status: "SIGNED_UP" } });
    }
    return waiting;
  }
}

// Decides what to do with an empty voice channel: delete it once it has been
// empty for VOICE_EMPTY_MINUTES. `emptySince` is null while people are in it.
export function shouldDeleteVoice(emptySince: Date | null, now: Date): boolean {
  return emptySince !== null && now.getTime() - emptySince.getTime() >= VOICE_EMPTY_MINUTES * 60_000;
}

export function shouldExpireOpenGroup(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() >= OPEN_GROUP_HOURS * 3_600_000;
}
