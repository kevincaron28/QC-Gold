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

describe("gear check: enchants, consumables and the peer digest", () => {
  // Item links carry the enchant id as their second field.
  const withGear = (s: LuaSession) => s.run(`
    LINKS = {
      [1] = "|cff|Hitem:100:0:0|h[Helm]|h|r", [3] = "|cff|Hitem:101:0:0|h[Spaulders]|h|r",
      [5] = "|cff|Hitem:102:1891:0|h[Chestguard]|h|r", [6] = "|cff|Hitem:103:0:0|h[Belt]|h|r",
      [7] = "|cff|Hitem:104:0:0|h[Legplates]|h|r", [8] = "|cff|Hitem:105:929:0|h[Boots]|h|r",
      [9] = "|cff|Hitem:106:0:0|h[Bracers]|h|r", [10] = "|cff|Hitem:107:0:0|h[Gloves]|h|r",
      [16] = "|cff|Hitem:108:0:0|h[Sword]|h|r", [17] = "|cff|Hitem:109:0:0|h[Shield]|h|r"
    }
    GetInventoryItemLink = function(_, slot) return LINKS[slot] end
    GetInventoryItemID = function(_, slot) return LINKS[slot] and tonumber(string.match(LINKS[slot], "item:(%d+)")) end
    GetInventoryItemDurability = function() return 90, 100 end
  `);

  it("finds equipped slots without an enchant and reports them", () => {
    const s = loggedIn();
    withGear(s);
    s.run(`SlashCmdList["QUEBECGOLD"]("inspect")`);
    const findings = s.run(`local f = {}; for _, x in ipairs(QuebecGoldDB.readiness["Kev"].findings) do f[#f + 1] = x.code .. "=" .. x.message end; return table.concat(f, ";")`);
    // Chest and Feet have enchant ids; Legs, Wrist, Hands and MainHand do not.
    expect(findings).toContain("MISSING_ENCHANTS=Missing enchants: Legs, Wrist, Hands, MainHand.");
    expect(s.run(`return QuebecGoldDB.readiness["Kev"].status`)).toBe("PARTIAL");
    expect(s.run(`return QuebecGoldDB.readiness["Kev"].items[3].enchants[1].enchantId`)).toBe("1891");
  });

  it("does not check enchants below the starting level, or when switched off", () => {
    const s = loggedIn();
    withGear(s);
    s.run(`UnitLevel = function() return 30 end; SlashCmdList["QUEBECGOLD"]("inspect")`);
    expect(s.run(`return QuebecGoldDB.readiness["Kev"].status`)).toBe("READY");
    s.run(`UnitLevel = function() return 60 end; SlashCmdList["QUEBECGOLD"]("enchants off"); SlashCmdList["QUEBECGOLD"]("inspect")`);
    expect(s.run(`return QuebecGoldDB.readiness["Kev"].status`)).toBe("READY");
  });

  it("in a raid group with no flask or food it warns, and the digest carries reason flags", () => {
    const s = loggedIn();
    withGear(s);
    s.run(`MOCK_RAID = true; MOCK_UNITS = { player = { name = "Kev", buffs = { "Blessing of Kings" } } }; SENT = {}; SlashCmdList["QUEBECGOLD"]("inspect")`);
    const codes = s.run(`local f = {}; for _, x in ipairs(QuebecGoldDB.readiness["Kev"].findings) do f[#f + 1] = x.code end; return table.concat(f, ",")`);
    expect(codes).toContain("NO_FLASK");
    expect(codes).toContain("NO_FOOD");
    const digest = s.run(`return SENT[#SENT].text`);
    expect(digest).toMatch(/^READINESS\|Kev\|PARTIAL\|0\|90\|/);
    expect(digest).toContain("|F:NOFLASK,NOFOOD,ENCH:Legs+Wrist+Hands+MainHand");
  });

  it("reads a peer digest whose profession field is empty (flags must not shift)", () => {
    const s = loggedIn();
    s.run(`fire_event("CHAT_MSG_ADDON", "QuebecGold", "READINESS|Amy|PARTIAL|0|95||F:NOFOOD", "GUILD", "Amy-Realm")`);
    expect(s.run(`return QuebecGoldDB.peerRoster["Amy"].flags .. "|" .. QuebecGoldDB.peerRoster["Amy"].professions`)).toBe("NOFOOD|");
    s.run(`fire_event("CHAT_MSG_ADDON", "QuebecGold", "READINESS|Bob|READY|0|100|Mining:300|F:NOFLASK", "GUILD", "Bob-Realm")`);
    expect(s.run(`return QuebecGoldDB.peerRoster["Bob"].flags .. "|" .. QuebecGoldDB.peerRoster["Bob"].professions`)).toBe("NOFLASK|Mining:300");
  });
});
