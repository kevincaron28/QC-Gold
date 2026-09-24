import type {
  Prisma,
  PrismaClient,
  RaidSignupStatus,
  RaidAttendanceStatus,
  RaidBossStatus,
  RaidStatus
} from "@prisma/client";

const activeSignupStatuses: RaidSignupStatus[] = ["SIGNED_UP"];

export interface CreateRaidInput {
  guildId: string;
  title: string;
  scheduledAt: Date;
  createdBy: string;
  description?: string;
  bosses?: string[];
}

export function createRaidService(database: PrismaClient) {
  async function getRaid(raidId: string, guildId: string) {
    const raid = await database.raid.findFirst({ where: { id: raidId, guildId } });
    if (!raid) throw new Error("Raid not found in this guild.");
    return raid;
  }

  return {
    async create(input: CreateRaidInput) {
      if (input.title.trim().length < 3) throw new Error("Raid title must be at least 3 characters.");
      if (input.scheduledAt.getTime() <= Date.now()) throw new Error("Raid time must be in the future.");
      const bosses = input.bosses?.map((name) => name.trim()).filter(Boolean) ?? [];
      return database.raid.create({
        data: {
          guildId: input.guildId,
          title: input.title.trim(),
          scheduledAt: input.scheduledAt,
          createdBy: input.createdBy,
          description: input.description?.trim() || null,
          ...(bosses.length > 0 ? {
            bosses: { create: bosses.map((name, sortOrder) => ({ name, sortOrder })) }
          } : {})
        },
        include: { bosses: true }
      });
    },

    async edit(raidId: string, guildId: string, input: {
      title?: string;
      description?: string | null;
      scheduledAt?: Date;
    }) {
      const raid = await getRaid(raidId, guildId);
      if (raid.status !== "PLANNED") throw new Error("Only planned raids can be edited.");
      if (input.title !== undefined && input.title.trim().length < 3) {
        throw new Error("Raid title must be at least 3 characters.");
      }
      if (input.scheduledAt !== undefined && input.scheduledAt.getTime() <= Date.now()) {
        throw new Error("Raid time must be in the future.");
      }
      return database.raid.update({
        where: { id: raid.id },
        data: {
          ...(input.title === undefined ? {} : { title: input.title.trim() }),
          ...(input.description === undefined ? {} : { description: input.description?.trim() || null }),
          ...(input.scheduledAt === undefined ? {} : { scheduledAt: input.scheduledAt })
        }
      });
    },

    async cancel(raidId: string, guildId: string) {
      const raid = await getRaid(raidId, guildId);
      if (raid.status === "COMPLETED") throw new Error("Completed raids cannot be cancelled.");
      if (raid.status === "CANCELLED") throw new Error("Raid is already cancelled.");
      return database.raid.update({ where: { id: raid.id }, data: { status: "CANCELLED" } });
    },

    async signup(raidId: string, guildId: string, memberId: string) {
      const raid = await getRaid(raidId, guildId);
      if (raid.status !== "PLANNED") throw new Error("Signups are closed for this raid.");
      return database.raidSignup.upsert({
        where: { raidId_memberId: { raidId, memberId } },
        create: { raidId, memberId },
        update: { status: "SIGNED_UP", signedUpAt: new Date(), cancelledAt: null }
      });
    },

    async cancelSignup(raidId: string, guildId: string, memberId: string) {
      const raid = await getRaid(raidId, guildId);
      if (raid.status === "COMPLETED" || raid.status === "CANCELLED") {
        throw new Error("This raid is no longer accepting signup changes.");
      }
      const signup = await database.raidSignup.findUnique({ where: { raidId_memberId: { raidId, memberId } } });
      if (!signup || signup.status === "CANCELLED") throw new Error("You are not signed up for this raid.");
      return database.raidSignup.update({
        where: { id: signup.id },
        data: { status: "CANCELLED", cancelledAt: new Date() }
      });
    },

    getStatus(raidId: string, guildId: string) {
      return database.raid.findFirst({
        where: { id: raidId, guildId },
        include: {
          bosses: { orderBy: { sortOrder: "asc" } },
          _count: { select: { signups: true, attendance: true } }
        }
      }).then((raid) => {
        if (!raid) throw new Error("Raid not found in this guild.");
        return raid;
      });
    },

    async roster(raidId: string, guildId: string): Promise<Array<Prisma.RaidSignupGetPayload<{ include: { member: true } }>>> {
      await getRaid(raidId, guildId);
      return database.raidSignup.findMany({
        where: { raidId, status: { in: activeSignupStatuses } },
        include: { member: true },
        orderBy: { signedUpAt: "asc" }
      });
    },

    async start(raidId: string, guildId: string) {
      const raid = await getRaid(raidId, guildId);
      if (raid.status !== "PLANNED") throw new Error("Only planned raids can be started.");
      return database.raid.update({
        where: { id: raid.id },
        data: { status: "ACTIVE", startedAt: new Date() }
      });
    },

    async end(raidId: string, guildId: string) {
      const raid = await getRaid(raidId, guildId);
      if (raid.status !== "ACTIVE") throw new Error("Only active raids can be ended.");
      return database.raid.update({
        where: { id: raid.id },
        data: { status: "COMPLETED", endedAt: new Date() }
      });
    },

    async recordAttendance(input: {
      raidId: string;
      guildId: string;
      memberId: string;
      status: RaidAttendanceStatus;
      recordedBy: string;
      notes?: string;
    }) {
      const raid = await getRaid(input.raidId, input.guildId);
      if (raid.status !== "ACTIVE" && raid.status !== "COMPLETED") {
        throw new Error("Attendance can only be recorded for an active or completed raid.");
      }
      return database.raidAttendance.upsert({
        where: { raidId_memberId: { raidId: input.raidId, memberId: input.memberId } },
        create: {
          raidId: input.raidId,
          memberId: input.memberId,
          status: input.status,
          recordedBy: input.recordedBy,
          ...(input.notes === undefined ? {} : { notes: input.notes.trim() || null })
        },
        update: {
          status: input.status,
          recordedBy: input.recordedBy,
          ...(input.notes === undefined ? {} : { notes: input.notes.trim() || null })
        }
      });
    },

    async setBossStatus(raidId: string, guildId: string, bossId: string, status: RaidBossStatus) {
      await getRaid(raidId, guildId);
      const boss = await database.raidBoss.findFirst({ where: { id: bossId, raidId } });
      if (!boss) throw new Error("Boss not found for this raid.");
      return database.raidBoss.update({
        where: { id: boss.id },
        data: { status, killedAt: status === "KILLED" ? new Date() : null }
      });
    }
  };
}

export type RaidService = ReturnType<typeof createRaidService>;
export type RaidStatusValue = RaidStatus;
