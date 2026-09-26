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

describe("why there is no standing", () => {
  it("names the real reason instead of always blaming the link", () => {
    const s = withSync();
    s.run(`fire_event("PLAYER_ENTERING_WORLD")`);
    // Nothing arrived yet.
    expect(s.run(`return NS.standingProblem("Ray")`)).toBe("none");
    expect(s.run(`return NS.standingProblemText("Ray")`)).toContain("have not arrived yet");
    // Arrived, but the bot had nobody linked when it wrote them.
    s.run(`DB.standings = { updatedAt = "2026-09-26T00:00:00Z", baseGp = 0, players = {} }`);
    expect(s.run(`return NS.standingProblem("Ray")`)).toBe("empty");
    expect(s.run(`return NS.standingProblemText("Ray")`)).toContain("no linked characters yet");
    // Arrived with others, but not this character.
    s.run(`DB.standings.players = { Amy = { ep = 10, gp = 0, pr = 1 } }`);
    expect(s.run(`return NS.standingProblem("Ray")`)).toBe("missing");
    expect(s.run(`return NS.standingProblemText("Ray")`)).toContain("Ray is not linked to a Discord member yet");
    expect(s.run(`return tostring(NS.standingProblem("Amy"))`)).toBe("nil");
  });
});

describe("module requests are rate limited", () => {
  it("answers one requester once, then waits for the cooldown", () => {
    const s = withSync();
    s.run(`
      NS.isOfficer = function() return true end
      NS.getSettings = function() return { guildModules = { updatedAt = 50, by = "Kev", off = {} } } end
      SENT = 0
      C_ChatInfo = { RegisterAddonMessagePrefix = function() end, SendAddonMessage = function(_, text) if string.find(text, "^MODS|") then SENT = SENT + 1 end end }
      fire_event("PLAYER_ENTERING_WORLD")
      for _ = 1, 4 do fire_event("CHAT_MSG_ADDON", "QuebecGoldSync", "MODSREQ|0", "GUILD", "Amy-Realm") end
      fire_event("CHAT_MSG_ADDON", "QuebecGoldSync", "MODSREQ|0", "GUILD", "Bob-Realm")
    `);
    expect(s.run(`return SENT`)).toBe("2");
  });
});
