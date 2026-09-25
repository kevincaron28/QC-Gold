import { describe, expect, it } from "vitest";
import { buildReadinessLines, chunkLines } from "../src/services/readiness-board.js";

describe("readiness board", () => {
  it("one line for ready players, problems listed for the rest, unknown for no check", async () => {
    const snapshots: Record<string, unknown> = {
      m1: { status: "READY", itemLevel: 62, character: { name: "Bob" }, findings: [{ severity: "INFO", message: "Required gear slots are populated." }] },
      m2: { status: "NOT_READY", itemLevel: null, character: { name: "Amy" }, findings: [{ severity: "ERROR", message: "Missing Head equipment." }] }
    };
    const database = {
      member: { findMany: async () => [{ id: "m1", displayName: "Bob" }, { id: "m2", displayName: "Amy" }, { id: "m3", displayName: "Cy" }] },
      inspectedCharacterSnapshot: { findFirst: async ({ where }: { where: { memberId: string } }) => snapshots[where.memberId] ?? null }
    };
    const lines = await buildReadinessLines(database as never, "g1");
    expect(lines[0]).toBe("✅ **Bob** — READY · ilvl 62");
    expect(lines[1]).toContain("❌ **Amy** — NOT_READY");
    expect(lines[1]).toContain("Missing Head equipment.");
    expect(lines[2]).toContain("Cy");
    expect(lines[2]).toContain("no gear check");
  });

  it("splits long boards under Discord's message limit", () => {
    const lines = Array.from({ length: 100 }, (_, i) => `line ${i} ${"x".repeat(40)}`);
    const chunks = chunkLines(lines, 500);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(500);
    expect(chunks.join("\n").split("\n")).toHaveLength(100);
  });
});

import { buildConsumableLines } from "../src/services/readiness-board.js";
import { parseAddonSnapshot } from "../src/integrations/addon.js";

describe("consumable scan", () => {
  const now = new Date("2026-10-01T20:00:00Z");
  const scannedAt = new Date("2026-10-01T19:48:00Z");

  it("lists who lacks a flask/elixir or food from the latest scan", async () => {
    const rows = [
      { character: "Amy", flask: "Flask of the Titans", elixirs: [], food: null, scannedAt },
      { character: "Bob", flask: null, elixirs: ["Elixir of the Mongoose"], food: "Well Fed", scannedAt },
      { character: "Cy", flask: null, elixirs: [], food: "Well Fed", scannedAt }
    ];
    const lines = await buildConsumableLines({ consumableCheck: { findMany: async () => rows } } as never, "g1", now);
    expect(lines[0]).toContain("3 scanned 12 min ago");
    expect(lines[1]).toContain("No flask/elixir: Cy");
    expect(lines[2]).toContain("No food: Amy");
  });

  it("says nobody when everyone is covered, and nothing without a fresh scan", async () => {
    const covered = [{ character: "Amy", flask: "Flask of Power", elixirs: [], food: "Well Fed", scannedAt }];
    const lines = await buildConsumableLines({ consumableCheck: { findMany: async () => covered } } as never, "g1", now);
    expect(lines[1]).toContain("nobody");
    expect(lines[2]).toContain("nobody");
    expect(await buildConsumableLines({ consumableCheck: { findMany: async () => [] } } as never, "g1", now)).toEqual([]);
  });

  it("accepts the export's consumeScan block", () => {
    const parsed = parseAddonSnapshot({
      source: "QuebecGold", exportedAt: "2026-10-01T20:00:00Z",
      consumeScan: { at: "2026-10-01T19:48:00Z", by: "Kev", players: [{ character: "Amy", realm: "R", flask: "Flask of Power", elixirs: [] }] }
    });
    expect(parsed.consumeScan?.players).toHaveLength(1);
  });
});
