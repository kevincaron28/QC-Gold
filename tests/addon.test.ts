import { describe, expect, it } from "vitest";
import { parseAddonSnapshot } from "../src/integrations/addon.js";

describe("parseAddonSnapshot", () => {
  it("accepts a normalized addon export", () => {
    const snapshot = parseAddonSnapshot({
      source: "ForeverLootManager",
      exportedAt: "2026-09-24T00:00:00.000Z",
      transactions: [{
        character: "Kevin",
        realm: "WoW Forever",
        amount: 10,
        type: "AWARD",
        reason: "Raid attendance"
      }]
    });
    expect(snapshot.transactions).toHaveLength(1);
  });

  it("rejects zero-value transactions", () => {
    expect(() => parseAddonSnapshot({
      source: "ForeverLootManager",
      exportedAt: "2026-09-24T00:00:00.000Z",
      transactions: [{
        character: "Kevin",
        realm: "WoW Forever",
        amount: 0,
        type: "AWARD",
        reason: "Invalid"
      }]
    })).toThrow();
  });
});
