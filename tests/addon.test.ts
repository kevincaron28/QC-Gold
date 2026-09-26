import { describe, expect, it } from "vitest";
import { parseAddonSnapshot, normalizeAddonSnapshot } from "../src/integrations/addon.js";

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

  it("accepts an EPGP-shaped transaction separate from the DKP transactions", () => {
    const snapshot = normalizeAddonSnapshot(parseAddonSnapshot({
      source: "Guilded",
      exportedAt: "2026-09-24T00:00:00.000Z",
      epgpTransactions: [{
        character: " Kevin ",
        realm: " WoW Forever ",
        epAmount: 10,
        gpAmount: 0,
        type: "EP_AWARD",
        reason: "Raid attendance"
      }]
    }));
    expect(snapshot.epgpTransactions).toHaveLength(1);
    expect(snapshot.epgpTransactions[0]?.character).toBe("Kevin");
    expect(snapshot.transactions).toHaveLength(0);
  });

  it("rejects an EPGP transaction that changes neither EP nor GP", () => {
    expect(() => parseAddonSnapshot({
      source: "Guilded",
      exportedAt: "2026-09-24T00:00:00.000Z",
      epgpTransactions: [{
        character: "Kevin",
        realm: "WoW Forever",
        epAmount: 0,
        gpAmount: 0,
        type: "ADJUSTMENT",
        reason: "No-op"
      }]
    })).toThrow();
  });

  it("accepts a readiness entry with no missing-slot findings", () => {
    const snapshot = parseAddonSnapshot({
      source: "Guilded",
      exportedAt: "2026-09-24T00:00:00.000Z",
      readiness: [{
        character: "Kevin",
        realm: "WoW Forever",
        items: [{ slot: "Head", itemName: "Lionheart Helm", itemId: "16795" }],
        findings: [{ code: "GEAR_PRESENT", severity: "INFO", message: "Required gear slots are populated." }]
      }]
    });
    expect(snapshot.readiness).toHaveLength(1);
    expect(snapshot.readiness[0]?.items[0]?.itemName).toBe("Lionheart Helm");
  });

  it("accepts professions embedded in a readiness entry", () => {
    const snapshot = parseAddonSnapshot({
      source: "Guilded",
      exportedAt: "2026-09-24T00:00:00.000Z",
      readiness: [{
        character: "Kevin",
        realm: "WoW Forever",
        professions: [{ name: "Blacksmithing", skillLevel: 225 }]
      }]
    });
    expect(snapshot.readiness[0]?.professions).toEqual([{ name: "Blacksmithing", skillLevel: 225 }]);
  });

  it("accepts and trims a top-level attunement entry", () => {
    const snapshot = normalizeAddonSnapshot(parseAddonSnapshot({
      source: "Guilded",
      exportedAt: "2026-09-24T00:00:00.000Z",
      attunements: [{ character: " Kevin ", realm: " WoW Forever ", name: " Onyxia Key ", completed: true }]
    }));
    expect(snapshot.attunements).toEqual([{ character: "Kevin", realm: "WoW Forever", name: "Onyxia Key", completed: true }]);
  });
});
