import { afterEach, describe, expect, it } from "vitest";
import { newLuaSession, type LuaSession } from "./harness.js";

// Loads the real Core.lua (plus Compat and the consumable module) against a mocked game.
let session: LuaSession | undefined;
afterEach(() => { session?.close(); session = undefined; });

function loggedIn(): LuaSession {
  session = newLuaSession();
  session.run(`
    QuebecGoldDB = nil
    SLASH = SlashCmdList
    NS = {}
    MOCK_UNITS = { player = { name = "Kev", buffs = { "Flask of the Titans", "Well Fed" } } }
  `);
  session.load("Core.lua");
  session.load("Compat.lua");
  session.load("Modules/Consumables.lua");
  session.run(`fire_event("PLAYER_LOGIN")`);
  return session;
}

describe("Core.lua (real file, mocked game)", () => {
  it("loads, logs in, and registers /qg", () => {
    const s = loggedIn();
    expect(s.run(`return tostring(SlashCmdList["QUEBECGOLD"] ~= nil)`)).toBe("true");
    expect(s.chat().join("\n")).toContain("Loaded.");
  });

  it("/qg character prints the QG1 line with class and race tokens", () => {
    const s = loggedIn();
    s.run(`SlashCmdList["QUEBECGOLD"]("character")`);
    expect(s.chat().join("\n")).toContain("QG1|Kev|TestRealm|WARRIOR|NightElf|60|");
  });
});

describe("player identity (Forever has no real realms)", () => {
  it("reads name and realm from the client, and /qg diag shows the raw values", () => {
    const s = loggedIn();
    expect(s.run(`local id = NS.compat.identity(); return id.name .. "|" .. id.realm .. "|" .. tostring(id.hasRealm)`)).toBe("Kev|TestRealm|true");
    s.run(`SlashCmdList["QUEBECGOLD"]("diag")`);
    expect(s.chat().join("\n")).toContain("Identity: name=Kev realm=TestRealm");
  });

  it("copes with a client that reports no realm at all", () => {
    const s = loggedIn();
    s.run(`GetRealmName = function() return "" end; GetNormalizedRealmName = nil`);
    expect(s.run(`local id = NS.compat.identity(); return tostring(id.hasRealm) .. "|" .. id.realm`)).toBe("false|");
    s.run(`SlashCmdList["QUEBECGOLD"]("character")`);
    expect(s.chat().join("\n")).toContain("QG1|Kev||WARRIOR");
  });
});
