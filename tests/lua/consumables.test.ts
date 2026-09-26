import { afterEach, describe, expect, it } from "vitest";
import { newLuaSession, type LuaSession } from "./harness.js";

// Loads the real Modules/Consumables.lua against a mocked game.
let session: LuaSession | undefined;
afterEach(() => { session?.close(); session = undefined; });

function withModule(): LuaSession {
  session = newLuaSession();
  session.run(String.raw`
    NS = {
      isSecret = function() return false end,
      now = function() return "2026-10-01T20:00:00Z" end,
      playerName = function() return "Kev" end,
      isOfficer = function() return true end,
      getActiveRaid = function() return nil end,
      message = function(text) CHAT_LOG = CHAT_LOG or {}; CHAT_LOG[#CHAT_LOG + 1] = text end,
      commandHandlers = {}, commandHelp = {},
      getDb = function() return DB end
    }
    DB = {}
  `);
  session.load("Modules/Consumables.lua");
  return session;
}

describe("Consumables.lua (real file, mocked game)", () => {
  it("classifies buff names by category", () => {
    const s = withModule();
    expect(s.run(`return NS.consumables.classify("Flask of the Titans")`)).toBe("flask");
    expect(s.run(`return NS.consumables.classify("Elixir of the Mongoose")`)).toBe("elixir");
    expect(s.run(`return NS.consumables.classify("Well Fed")`)).toBe("food");
    expect(s.run(`return tostring(NS.consumables.classify("Blessing of Kings"))`)).toBe("nil");
  });

  it("reads your own active consumables", () => {
    const s = withModule();
    s.run(`MOCK_UNITS = { player = { name = "Kev", buffs = { "Flask of Supreme Power", "Well Fed", "Blessing of Kings" } } }`);
    expect(s.run(`local r = NS.consumables.scanUnit("player"); return tostring(r.flask) .. "|" .. tostring(r.food) .. "|" .. tostring(r.readable)`))
      .toBe("Flask of Supreme Power|Well Fed|true");
  });

  it("/guilded consumes lists who lacks a flask or food in the group", () => {
    const s = withModule();
    s.run(`
      MOCK_RAID = false
      MOCK_UNITS = {
        player = { name = "Kev", buffs = { "Flask of Supreme Power", "Well Fed" } },
        party1 = { name = "Amy", buffs = { "Elixir of the Mongoose" } },
        party2 = { name = "Bob", buffs = { "Well Fed" } },
        party3 = { name = "Cy", buffs = { "Blessing of Kings" } }
      }
      NS.commandHandlers["consumes"]({})
    `);
    const chat = s.chat().join("\n");
    expect(chat).toContain("4 player(s) checked");
    expect(chat).toContain("No flask or elixir: Bob, Cy");
    expect(chat).toContain("No food buff: Amy, Cy");
    // The scan is saved for the export.
    expect(s.run(`return tostring(#DB.consumeScan.players)`)).toBe("4");
  });

  it("only officers can scan the group", () => {
    const s = withModule();
    s.run(`NS.isOfficer = function() return false end; MOCK_UNITS = { player = { name = "Kev", buffs = {} } }; NS.commandHandlers["consumes"]({})`);
    expect(s.chat().join("\n")).toContain("Only officers can scan the group");
  });

  it("builds snapshot rows for your own buffs", () => {
    const s = withModule();
    s.run(`MOCK_UNITS = { player = { name = "Kev", buffs = { "Flask of the Titans", "Well Fed" } } }`);
    expect(s.run(`local rows = NS.consumables.ownRows(); return #rows .. ":" .. rows[1].category .. ":" .. rows[2].category`)).toBe("2:FLASK:FOOD");
  });
});
