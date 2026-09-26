import { describe, expect, it } from "vitest";
import { formatChecks, setupChecks, setupComplete, type SetupFacts } from "../src/services/setup-status.js";

const channel = (name: string) => ({ name, exists: true, botCanPost: true });
const done: SetupFacts = {
  existingRoleNames: ["Guild Master", "Officer", "Raid Leader", "DKP Officer"],
  requiredRoleNames: ["Guild Master", "Officer", "Raid Leader", "DKP Officer"],
  notifyChannel: channel("guilded-announcements"),
  raidChannel: channel("raid-signups"),
  logChannel: channel("officer-log"),
  welcomeChannel: null,
  autoRoles: [],
  epgpConfigured: false,
  remindersOn: true,
  weeklyReportOn: false,
  companionTokenSet: false,
  linkedCharacters: 0
};

describe("setup checklist", () => {
  it("is complete when only optional items are missing", () => {
    expect(setupComplete(setupChecks(done))).toBe(true);
  });

  it("names the missing roles and how to fix them", () => {
    const checks = setupChecks({ ...done, existingRoleNames: ["Officer"] });
    expect(setupComplete(checks)).toBe(false);
    expect(formatChecks(checks)).toContain("Missing: Guild Master, Raid Leader, DKP Officer");
  });

  it("flags deleted channels and channels the bot can't post in", () => {
    const checks = setupChecks({
      ...done,
      notifyChannel: { name: "x", exists: false, botCanPost: false },
      logChannel: { name: "officer-log", exists: true, botCanPost: false }
    });
    const text = formatChecks(checks);
    expect(text).toContain("The saved channel was deleted");
    expect(text).toContain("I can't post in #officer-log");
    expect(setupComplete(checks)).toBe(false);
  });

  it("warns when the bot's role is below an auto-role", () => {
    const text = formatChecks(setupChecks({ ...done, autoRoles: [{ name: "Member", botCanAssign: false }] }));
    expect(text).toContain("My role must be above \"Member\"");
  });
});
