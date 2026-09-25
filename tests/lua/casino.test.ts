import { afterEach, describe, expect, it } from "vitest";
import { newLuaSession, type LuaSession } from "./harness.js";

let session: LuaSession | undefined;
afterEach(() => { session?.close(); session = undefined; });

function withCasino(): LuaSession {
  session = newLuaSession();
  session.run(`
    QuebecGoldCasinoDB = nil
    MOCK_RAID = false
    function IsInGroup() return true end
    NS = {
      isSecret = function() return false end,
      normalizeName = function(n) if not n then return nil end return (string.gsub(string.match(n, "^([^%-]+)") or n, "^%l", string.upper)) end,
      playerName = function() return "Host" end,
      isOfficer = function() return true end, isOfficerName = function() return true end,
      now = function() return "2026-10-01T20:00:00Z" end,
      parseRoll = function() return nil end,
      message = function(text) CHAT_LOG = CHAT_LOG or {}; CHAT_LOG[#CHAT_LOG + 1] = text end,
      commandHandlers = {}, commandHelp = {}
    }
  `);
  session.load("Modules/Casino.lua");
  session.run(`fire_event("PLAYER_LOGIN")`);
  return session;
}

const casino = (s: LuaSession, command: string) => s.run(`local args = {}; for w in string.gmatch(${JSON.stringify(command)}, "%S+") do args[#args + 1] = w end; NS.commandHandlers["casino"](args)`);

describe("Casino.lua ban list and stats", () => {
  it("bans, lists and unbans players", () => {
    const s = withCasino();
    casino(s, "ban Amy cheats at deathrolls");
    casino(s, "bans");
    expect(s.chat().join("\n")).toContain("Casino ban list: Amy (cheats at deathrolls)");
    casino(s, "unban Amy");
    casino(s, "bans");
    expect(s.chat().join("\n")).toContain("Your casino ban list is empty.");
    casino(s, "ban Bob");
    casino(s, "resetbans");
    expect(s.run(`return tostring(next(QuebecGoldCasinoDB.bans))`)).toBe("nil");
  });

  it("does not add a banned player to a group game, but adds others", () => {
    const s = withCasino();
    casino(s, "ban Amy");
    casino(s, "pot 10g");
    s.run(`NS.casino.session.players = NS.casino.session.players or {}; fire_event("CHAT_MSG_PARTY", "1", "Amy-Realm"); fire_event("CHAT_MSG_PARTY", "1", "Bob-Realm")`);
    expect(s.run(`local n = {}; for k in pairs(NS.casino.session.players) do n[#n + 1] = k end; table.sort(n); return table.concat(n, ",")`)).toBe("Bob");
    expect(s.chat().join("\n")).toContain("Amy is on your casino ban list");
  });

  it("refuses a house game with a banned player", () => {
    const s = withCasino();
    casino(s, "ban Amy");
    casino(s, "blackjack Amy 5g");
    expect(s.chat().join("\n")).toContain("Amy is on your casino ban list");
    expect(s.run(`return tostring(NS.casino.houseBets["Amy"])`)).toBe("nil");
  });

  it("summarises games hosted and biggest winners and losers from the ledger", () => {
    const s = withCasino();
    s.run(`
      QuebecGoldCasinoDB.games = 7
      QuebecGoldCasinoDB.ledger = {
        Amy = { won = 30000, lost = 10000, debts = {}, history = {} },
        Bob = { won = 0, lost = 50000, debts = {}, history = {} },
        Cy = { won = 5000, lost = 5000, debts = {}, history = {} }
      }
    `);
    casino(s, "stats");
    const text = s.chat().join("\n");
    expect(text).toContain("7 game(s) hosted, 3 player(s) with results");
    expect(text).toContain("Biggest winners: Amy +2g");
    expect(text).toContain("Biggest losers: Bob -5g");
  });
});
