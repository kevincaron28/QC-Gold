import { describe, expect, it } from "vitest";
import { dungeonAnnouncement } from "../src/services/dungeon-announce.js";
import type { DungeonImportResult } from "../src/services/dungeon-import.js";

const result = (overrides: Partial<DungeonImportResult>): DungeonImportResult => ({
  runRef: "QG-1", dungeonName: "Deadmines", difficultyId: 1, state: "COMPLETED", valid: true, durationSec: 1300, points: 0,
  guildRecord: false, previousGuildBest: null, personalRecords: [], players: ["Kev", "Bob"], deaths: 0, unlinked: [], ...overrides
});

describe("dungeonAnnouncement", () => {
  it("posts nothing when no run was completed and valid", () => {
    const summary = { results: [result({ state: "ABANDONED" }), result({ valid: false, invalidReason: "too short" })], duplicates: 3, malformed: 0 };
    expect(dungeonAnnouncement(summary, "en")).toBeNull();
  });

  it("lists completed runs and the records they set, in the guild language", () => {
    const summary = {
      results: [
        result({ guildRecord: true, previousGuildBest: 1500, personalRecords: [{ character: "Kev", previous: 1500, now: 1300 }] }),
        result({ runRef: "QG-2", dungeonName: "Shadowfang Keep", difficultyId: 0, deaths: null }),
        result({ runRef: "QG-3", state: "ABANDONED" })
      ],
      duplicates: 0, malformed: 0
    };
    const embed = dungeonAnnouncement(summary, "fr")?.toJSON();
    expect(embed?.description).toContain("✅ **Deadmines (Normal)** 21:40 · aucune mort");
    expect(embed?.description).toContain("✅ **Shadowfang Keep** 21:40\n");
    expect(embed?.description?.match(/✅/g)).toHaveLength(2);
    expect(embed?.fields?.[0]?.value).toContain("Nouveau record de guilde dans **Deadmines (Normal)** : 25:00 → **21:40**");
    expect(embed?.fields?.[0]?.value).toContain("Record personnel dans Deadmines (Normal) : Kev");
  });
});

describe("test dungeon runs", () => {
  it("are marked [TEST] in the channel", () => {
    const embed = dungeonAnnouncement({ results: [result({ runRef: "SIM-1790000000-abcde", dungeonName: "Test Dungeon" })], duplicates: 0, malformed: 0 }, "en");
    expect(embed?.toJSON().description).toContain("**[TEST] Test Dungeon (Normal)**");
  });
});
