import { afterEach, describe, expect, it } from "vitest";
import { newLuaSession, type LuaSession } from "./harness.js";

let session: LuaSession | undefined;
afterEach(() => { session?.close(); session = undefined; });

function withDigest(): LuaSession {
  session = newLuaSession();
  session.run(`
    DB = {
      roster = { Amy = { firstSeen = "2026-09-25T10:00:00Z" }, Old = { firstSeen = "2026-09-01T10:00:00Z" } },
      epgp = { Bob = { ledger = { { at = "2026-09-25T12:00:00Z" }, { at = "2026-09-20T12:00:00Z" } } } },
      raids = { r1 = { endedAt = "2026-09-25T22:00:00Z" }, r2 = { endedAt = "2026-09-10T22:00:00Z" } },
      loot = { { at = "2026-09-25T21:00:00Z" }, { at = "2026-09-25T21:30:00Z" } }
    }
    NS = {
      now = function() return "2026-09-26T09:00:00Z" end,
      message = function(text) CHAT_LOG = CHAT_LOG or {}; CHAT_LOG[#CHAT_LOG + 1] = text end,
      getDb = function() return DB end,
      commandHandlers = {}, commandHelp = {}
    }
  `);
  session.load("Modules/Digest.lua");
  return session;
}

describe("Digest.lua", () => {
  it("summarises only what is newer than the last login", () => {
    const s = withDigest();
    s.run(`DB.digest = { lastSeen = "2026-09-24T00:00:00Z", enabled = true }; NS.commandHandlers["digest"]({})`);
    const text = s.chat().join("\n");
    expect(text).toContain("1 new guild member(s) seen");
    expect(text).toContain("1 EPGP change(s)");
    expect(text).toContain("1 raid(s) finished");
    expect(text).toContain("2 item(s) looted");
  });

  it("says nothing changed, and starts the clock silently on the first login", () => {
    const s = withDigest();
    s.run(`DB.digest = { lastSeen = "2026-09-26T08:00:00Z", enabled = true }; NS.commandHandlers["digest"]({})`);
    expect(s.chat().join("\n")).toContain("Nothing new since 2026-09-26T08:00:00Z");
    s.run(`DB.digest = nil; fire_event("PLAYER_LOGIN")`);
    expect(s.run(`return DB.digest.lastSeen`)).toBe("2026-09-26T09:00:00Z");
    expect(s.chat().join("\n")).not.toContain("Since your last login");
  });

  it("records the logout time so the next login covers the gap", () => {
    const s = withDigest();
    s.run(`DB.digest = { lastSeen = "2026-09-24T00:00:00Z", enabled = true }; fire_event("PLAYER_LOGOUT")`);
    expect(s.run(`return DB.digest.lastSeen`)).toBe("2026-09-26T09:00:00Z");
  });
});
