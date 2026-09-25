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
