import { describe, expect, it, vi } from "vitest";
import { isReminderDue, runRaidReminders } from "../src/services/reminders.js";

const now = new Date("2026-10-01T19:10:00Z");
const start = new Date("2026-10-01T20:00:00Z");

describe("raid reminders", () => {
  it("is due inside the window, once, and not after start", () => {
    expect(isReminderDue({ now, scheduledAt: start, minutes: 60, sentAt: null })).toBe(true);
    expect(isReminderDue({ now, scheduledAt: start, minutes: 30, sentAt: null })).toBe(false);
    expect(isReminderDue({ now, scheduledAt: start, minutes: 60, sentAt: now })).toBe(false);
    expect(isReminderDue({ now, scheduledAt: start, minutes: 0, sentAt: null })).toBe(false);
    expect(isReminderDue({ now: new Date("2026-10-01T20:05:00Z"), scheduledAt: start, minutes: 60, sentAt: null })).toBe(false);
  });

  it("marks the raid before pinging only signed-up members", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const channel = { isTextBased: () => true, send };
    const client = { guilds: { fetch: vi.fn().mockResolvedValue({ channels: { fetch: vi.fn().mockResolvedValue(channel) } }) } };
    const update = vi.fn().mockResolvedValue({});
    const database = {
      raid: {
        findMany: vi.fn().mockResolvedValue([{
          id: "r1", title: "MC", scheduledAt: start, reminderSentAt: null, signupChannelId: "chan",
          guild: { discordId: "g", settings: { raidReminderMinutes: 60, raidSignupChannelId: null } },
          signups: [{ member: { discordUserId: "111" } }, { member: { discordUserId: "222" } }]
        }]),
        update
      }
    };
    expect(await runRaidReminders(client as never, database as never, now)).toBe(1);
    expect(update).toHaveBeenCalledWith({ where: { id: "r1" }, data: { reminderSentAt: now } });
    expect(send.mock.calls[0]?.[0].allowedMentions).toEqual({ users: ["111", "222"] });
  });
});
