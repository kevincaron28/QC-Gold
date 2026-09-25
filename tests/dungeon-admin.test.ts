import { describe, expect, it } from "vitest";
import { adjustPoints, describeConfig, setWeeklyRepeat } from "../src/services/dungeon-admin.js";
import { dungeonConfig } from "../src/services/dungeon-rules.js";

const noDb = {} as Parameters<typeof adjustPoints>[0];

describe("dungeon admin", () => {
  it("refuses zero or huge manual awards before touching the database", async () => {
    await expect(adjustPoints(noDb, "g", "m", 0, "x", "o")).rejects.toThrow(/not 0/);
    await expect(adjustPoints(noDb, "g", "m", 20_000, "x", "o")).rejects.toThrow();
    await expect(adjustPoints(noDb, "g", "m", 1.5, "x", "o")).rejects.toThrow();
  });

  it("rejects weekly shares outside 0-100%", async () => {
    await expect(setWeeklyRepeat(noDb, "g", "100,150")).rejects.toThrow(/percents/);
    await expect(setWeeklyRepeat(noDb, "g", "abc")).rejects.toThrow(/percents/);
  });

  it("shows changed rules with their default and named target times", () => {
    const text = describeConfig(dungeonConfig({ completion: 60, targets: { "36": 1500 }, weeklyRepeat: [1, 0.75] }), new Map([[36, "Deadmines"]]));
    expect(text).toContain("`completion` 60 (default 50)");
    expect(text).toContain("`noDeaths` 25 ·");
    expect(text).toContain("100% → 75%");
    expect(text).toContain("Deadmines 25:00");
  });
});

describe("achievement rules", () => {
  it("qualify from the run's facts and the dungeon count", async () => {
    const { qualifiedAchievements, achievementName } = await import("../src/services/dungeon-achievements.js");
    expect(qualifiedAchievements({ guildRecord: false, fullGuildGroup: false, underTarget: false, deathless: false }, 1, 10)).toEqual(["firstBlood"]);
    expect(qualifiedAchievements({ guildRecord: true, fullGuildGroup: true, underTarget: true, deathless: true }, 10, 10))
      .toEqual(["firstBlood", "noOneDies", "speedDemon", "recordBreaker", "guildSquad", "dungeonMaster"]);
    expect(achievementName("seasonChampion:abc", "fr", "Saison 1")).toBe("👑 Champion de saison (Saison 1)");
    expect(achievementName("unknownThing", "en")).toBe("unknownThing");
  });
});
