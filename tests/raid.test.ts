import { describe, expect, it, vi } from "vitest";
import { createRaidService } from "../src/services/raid.js";

describe("raid service", () => {
  it("rejects short titles before touching the database", async () => {
    const service = createRaidService({} as never);
    await expect(service.create({
      guildId: "guild",
      title: "ab",
      scheduledAt: new Date(Date.now() + 60_000),
      createdBy: "officer"
    })).rejects.toThrow("Raid title must be at least 3 characters.");
  });

  it("rejects raids scheduled in the past", async () => {
    const service = createRaidService({} as never);
    await expect(service.create({
      guildId: "guild",
      title: "Molten Core",
      scheduledAt: new Date(Date.now() - 60_000),
      createdBy: "officer"
    })).rejects.toThrow("Raid time must be in the future.");
  });

  it("waitlists a signup once the role cap is reached", async () => {
    const raid = { id: "raid1", guildId: "guild", status: "PLANNED", tankLimit: 1, healerLimit: null, dpsLimit: null };
    const upsert = vi.fn().mockImplementation(async ({ create }) => create);
    const database = {
      raid: { findFirst: vi.fn().mockResolvedValue(raid) },
      raidSignup: { count: vi.fn().mockResolvedValue(1), upsert }
    } as never;
    const service = createRaidService(database);
    await expect(service.signup("raid1", "guild", "member2", "TANK")).resolves.toMatchObject({ status: "WAITLISTED" });
  });

  it("records a maybe without using a slot", async () => {
    const raid = { id: "raid1", guildId: "guild", status: "PLANNED", tankLimit: 1, healerLimit: null, dpsLimit: null };
    const raidSignup = { count: vi.fn(), upsert: vi.fn().mockImplementation(async ({ create }) => create) };
    const service = createRaidService({ raid: { findFirst: vi.fn().mockResolvedValue(raid) }, raidSignup } as never);
    await expect(service.signup("raid1", "guild", "member2", "TANK", "MAYBE")).resolves.toMatchObject({ status: "MAYBE" });
    expect(raidSignup.count).not.toHaveBeenCalled();
  });

  it("promotes the earliest waitlisted player when a slot opens", async () => {
    const raid = { id: "raid1", guildId: "guild", status: "PLANNED", tankLimit: 1, healerLimit: null, dpsLimit: null };
    const update = vi.fn().mockImplementation(async ({ where, data }) => ({ id: where.id, ...data }));
    const database = {
      raid: { findFirst: vi.fn().mockResolvedValue(raid), findUnique: vi.fn().mockResolvedValue(raid) },
      raidSignup: {
        findUnique: vi.fn().mockResolvedValue({ id: "s1", status: "SIGNED_UP", role: "TANK" }),
        update,
        findMany: vi.fn().mockImplementation(async ({ where }) => where.role === "TANK"
          ? [{ id: "s2", memberId: "early", member: { displayName: "Early" } }, { id: "s3", memberId: "late", member: { displayName: "Late" } }]
          : []),
        count: vi.fn().mockResolvedValue(0)
      }
    } as never;
    const result = await createRaidService(database).cancelSignup("raid1", "guild", "member1");
    expect(result.promoted.map((signup) => signup.memberId)).toEqual(["early"]);
    expect(update).toHaveBeenCalledWith({ where: { id: "s2" }, data: { status: "SIGNED_UP" } });
  });

  it("allows a signup when under the role cap, excluding the requester's own existing slot", async () => {
    const raid = { id: "raid1", guildId: "guild", status: "PLANNED", tankLimit: 1, healerLimit: null, dpsLimit: null };
    const upserted = { id: "signup1", raidId: "raid1", memberId: "member1", role: "TANK" };
    const database = {
      raid: { findFirst: vi.fn().mockResolvedValue(raid) },
      raidSignup: { count: vi.fn().mockResolvedValue(0), upsert: vi.fn().mockResolvedValue(upserted) }
    } as never;
    const service = createRaidService(database);
    await expect(service.signup("raid1", "guild", "member1", "TANK")).resolves.toEqual(upserted);
  });

  it("does not cap a role with no configured limit", async () => {
    const raid = { id: "raid1", guildId: "guild", status: "PLANNED", tankLimit: null, healerLimit: null, dpsLimit: null };
    const upserted = { id: "signup1", raidId: "raid1", memberId: "member1", role: "DPS" };
    const raidSignup = { count: vi.fn(), upsert: vi.fn().mockResolvedValue(upserted) };
    const database = { raid: { findFirst: vi.fn().mockResolvedValue(raid) }, raidSignup } as never;
    const service = createRaidService(database);
    await expect(service.signup("raid1", "guild", "member1", "DPS")).resolves.toEqual(upserted);
    expect(raidSignup.count).not.toHaveBeenCalled();
  });
});
