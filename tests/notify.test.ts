import { describe, expect, it } from "vitest";
import { notifications } from "../src/services/notify.js";

describe("notification lines", () => {
  it("formats EPGP changes with signs and skips the zero side", () => {
    expect(notifications.epgpChanged("Kev", 10, 0, "Raid")).toBe("💰 Kev: +10 EP (Raid)");
    expect(notifications.epgpChanged("Kev", 0, 25, "Sword")).toBe("💰 Kev: +25 GP (Sword)");
    expect(notifications.epgpChanged("Kev", -10, -5, "fix")).toBe("💰 Kev: -10 EP, -5 GP (fix)");
  });

  it("summarizes an import in one line", () => {
    expect(notifications.importApplied(1, 0)).toBe("📥 Addon import applied: 1 EPGP entry");
    expect(notifications.importApplied(12, 2)).toBe("📥 Addon import applied: 12 EPGP entries, attendance for 2 raid(s)");
  });
});
