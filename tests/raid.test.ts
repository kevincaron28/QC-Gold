import { describe, expect, it } from "vitest";
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
});
