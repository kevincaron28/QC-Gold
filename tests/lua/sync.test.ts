import { afterEach, describe, expect, it } from "vitest";
import { newLuaSession, type LuaSession } from "./harness.js";

let session: LuaSession | undefined;
afterEach(() => { session?.close(); session = undefined; });

function withSync(): LuaSession {
  session = newLuaSession();
  session.run(`
    GetAddOnMetadata = function() return "2.0.0" end
    DB = {}
    NS = {
      isSecret = function() return false end,
      normalizeName = function(n) return (string.gsub(string.match(n, "^([^%-]+)") or n, "^%l", string.upper)) end,
      playerName = function() return "Kev" end,
      isOfficer = function() return false end, isOfficerName = function() return false end,
      getDb = function() return DB end,
      message = function(text) CHAT_LOG = CHAT_LOG or {}; CHAT_LOG[#CHAT_LOG + 1] = text end,
      commandHandlers = {}, commandHelp = {}
    }
  `);
  session.load("Modules/Sync.lua");
  return session;
}

describe("Sync.lua", () => {
  it("/qg peers lists who runs which version and who is older", () => {
    const s = withSync();
    s.run(`
      fire_event("PLAYER_ENTERING_WORLD")
      fire_event("CHAT_MSG_ADDON", "QuebecGoldSync", "VERSION|1.5.0", "GUILD", "Amy-Realm")
      fire_event("CHAT_MSG_ADDON", "QuebecGoldSync", "VERSION|2.0.0", "GUILD", "Bob-Realm")
      NS.commandHandlers["peers"]({})
    `);
    const text = s.chat().join("\n");
    expect(text).toContain("2 addon user(s) seen");
    expect(text).toContain("Amy 1.5.0 (older)");
    expect(text).toContain("Bob 2.0.0");
    expect(text).toContain("you run 2.0.0, 1 older");
  });

  it("ignores message kinds it does not know", () => {
    const s = withSync();
    s.run(`fire_event("PLAYER_ENTERING_WORLD"); fire_event("CHAT_MSG_ADDON", "QuebecGoldSync", "FUTURE|whatever|1|2", "GUILD", "Amy-Realm"); NS.commandHandlers["peers"]({})`);
    expect(s.chat().join("\n")).toContain("No guildmate with the addon has announced a version");
  });
});
