import { afterEach, describe, expect, it } from "vitest";
import { newLuaSession, type LuaSession } from "./harness.js";

let session: LuaSession | undefined;
afterEach(() => { session?.close(); session = undefined; });

function withGames(): LuaSession {
  session = newLuaSession();
  session.run(String.raw`
    function IsInGroup() return true end
    SENT_CHAT = {}
    C_ChatInfo = { SendChatMessage = function(text, channel) SENT_CHAT[#SENT_CHAT + 1] = text end }
    NS = {
      isSecret = function() return false end,
      normalizeName = function(n) if not n then return nil end return (string.gsub(string.match(n, "^([^%-]+)") or n, "^%l", string.upper)) end,
      playerName = function() return "Host" end,
      parseRoll = function(text)
        local name, value, low, high = string.match(text, "^(%S+) rolls (%d+) %((%d+)%-(%d+)%)$")
        if not name then return nil end
        return name, tonumber(value), tonumber(low), tonumber(high)
      end,
      message = function(text) CHAT_LOG = CHAT_LOG or {}; CHAT_LOG[#CHAT_LOG + 1] = text end,
      commandHandlers = {}, commandHelp = {}
    }
  `);
  session.load("Modules/Games.lua");
  return session;
}

const game = (s: LuaSession, line: string) => s.run(`local a = {}; for w in string.gmatch(${JSON.stringify(line)}, "%S+") do a[#a + 1] = w end; NS.commandHandlers["games"](a)`);
const say = (s: LuaSession, who: string, text: string) => s.run(`fire_event("CHAT_MSG_PARTY", ${JSON.stringify(text)}, ${JSON.stringify(who + "-Realm")})`);
const roll = (s: LuaSession, who: string, value: number, max: number) => s.run(`fire_event("CHAT_MSG_SYSTEM", "${who} rolls ${value} (1-${max})")`);
const chat = (s: LuaSession) => s.chat().join("\n");

describe("Games.lua (fun roll games, no gold)", () => {
  it("high roll: players join in chat, everyone rolls, the highest wins", () => {
    const s = withGames();
    game(s, "highroll");
    for (const who of ["Amy", "Bob", "Cy"]) say(s, who, "1");
    game(s, "roll");
    roll(s, "Amy", 40, 100);
    roll(s, "Bob", 91, 100);
    roll(s, "Outsider", 100, 100);     // not in the game: ignored
    roll(s, "Cy", 12, 100);
    expect(chat(s)).toContain("High Roll: Bob wins with 91!");
    expect(s.run(`return tostring(NS.games.session)`)).toBe("nil");
  });

  it("high roll: a tie goes to a roll-off between the tied players only", () => {
    const s = withGames();
    game(s, "highroll 50");
    for (const who of ["Amy", "Bob", "Cy"]) say(s, who, "1");
    game(s, "roll");
    roll(s, "Amy", 30, 50); roll(s, "Bob", 30, 50); roll(s, "Cy", 5, 50);
    expect(chat(s)).toContain("Tie at 30! Roll-off:");
    roll(s, "Cy", 50, 50);              // Cy was not in the roll-off
    roll(s, "Amy", 10, 50); roll(s, "Bob", 20, 50);
    expect(chat(s)).toContain("Bob wins with 20!");
  });

  it("group deathroll: lowest is out each round, the last one left wins", () => {
    const s = withGames();
    game(s, "deathroll");
    for (const who of ["Amy", "Bob", "Cy"]) say(s, who, "1");
    game(s, "roll");
    roll(s, "Amy", 50, 100); roll(s, "Bob", 80, 100); roll(s, "Cy", 7, 100);
    expect(chat(s)).toContain("Round 2 - Cy is out");
    expect(chat(s)).toContain("/roll 7 now: Amy, Bob");
    roll(s, "Amy", 3, 7); roll(s, "Bob", 6, 7);
    expect(chat(s)).toContain("Deathroll: Amy is out. Bob wins!");
  });

  it("duel: alternate rolls of the last number, whoever rolls 1 loses", () => {
    const s = withGames();
    game(s, "duel Amy 100");
    roll(s, "Amy", 5, 100);             // not Amy's turn (the challenger starts)
    roll(s, "Host", 60, 100);
    roll(s, "Host", 30, 60);            // Host again: ignored, it is Amy's turn
    roll(s, "Amy", 20, 60);
    roll(s, "Host", 1, 20);
    expect(chat(s)).toContain("Host rolled 60. Amy: /roll 60");
    expect(chat(s)).toContain("Host rolled 1 and loses! Amy wins the duel.");
    expect(s.run(`return tostring(NS.games.duel)`)).toBe("nil");
  });

  it("needs a group, refuses self-duels and a second game, and can be cancelled", () => {
    const s = withGames();
    s.run(`function IsInGroup() return false end`);
    game(s, "highroll");
    expect(chat(s)).toContain("Form a party or raid first");
    s.run(`function IsInGroup() return true end`);
    game(s, "duel Host");
    expect(chat(s)).toContain("cannot duel yourself");
    game(s, "highroll");
    game(s, "deathroll");
    expect(chat(s)).toContain("A game is already open");
    game(s, "cancel");
    expect(s.run(`return tostring(NS.games.session)`)).toBe("nil");
  });

  it("posts short, merged lines in party chat and knows nothing about gold", () => {
    const s = withGames();
    s.run(`C_Timer = { After = function(_, fn) fn() end }`);
    game(s, "highroll");
    expect(s.run(`return SENT_CHAT[1]:sub(1, 5)`)).toBe("[QG] ");
    expect(s.run(`return SENT_CHAT[1]`)).toContain("High Roll up to 100!");
    expect(s.run(`return tostring(NS.games.ledger) .. tostring(NS.commandHandlers["games"] ~= nil)`)).toBe("niltrue");
  });

  it("the old /qg casino command only points at the new games", () => {
    const s = withGames();
    s.run(`NS.commandHandlers["casino"]({ "pot", "10g" })`);
    expect(chat(s)).toContain("The casino was removed");
  });
});
