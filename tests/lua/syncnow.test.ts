import { afterEach, describe, expect, it } from "vitest";
import { newLuaSession, type LuaSession } from "./harness.js";

let session: LuaSession | undefined;
afterEach(() => { session?.close(); session = undefined; });

function withSync(officer = true): LuaSession {
  session = newLuaSession();
  session.run(`
    DB = {}
    NOW = 100000
    time = function() return NOW end
    RELOADS = 0
    ReloadUI = function() RELOADS = RELOADS + 1 end
    COMBAT = false
    INSTANCE = false
    InCombatLockdown = function() return COMBAT end
    UnitAffectingCombat = function() return COMBAT end
    IsInInstance = function() return INSTANCE end
    TIMERS = {}
    C_Timer = { After = function(_, fn) TIMERS[#TIMERS + 1] = fn end }
    NS = {
      isOfficer = function() return ${officer} end,
      getDb = function() return DB end,
      message = function(text) CHAT_LOG = CHAT_LOG or {}; CHAT_LOG[#CHAT_LOG + 1] = text end,
      commandHandlers = {}, commandHelp = {}
    }
  `);
  session.load("Modules/SyncNow.lua");
  session.run(`fire_event("PLAYER_LOGIN")`);
  return session;
}

const advance = (s: LuaSession, seconds: number) => s.run(`NOW = NOW + ${seconds}`);
const runTimers = (s: LuaSession) => s.run(`local t = TIMERS; TIMERS = {}; for _, fn in ipairs(t) do fn() end`);
const reloads = (s: LuaSession) => Number(s.run(`return RELOADS`));

describe("SyncNow.lua", () => {
  it("does nothing until something changed, then waits for the changes to settle and the interval to pass", () => {
    const s = withSync();
    advance(s, 3600);
    s.run(`NS.syncNow.tick()`);
    expect(s.run(`return #TIMERS`)).toBe("0");
    s.run(`NS.syncNow.mark()`);
    advance(s, 30);
    s.run(`NS.syncNow.tick()`);
    expect(s.run(`return #TIMERS`)).toBe("0");   // still settling
    advance(s, 100);
    s.run(`NS.syncNow.tick()`);
    expect(s.run(`return #TIMERS`)).toBe("1");   // countdown started
    runTimers(s);
    expect(reloads(s)).toBe(1);
    expect(s.chat().join("\n")).toContain("reloading in 5 seconds");
  });

  it("respects the minimum interval since login", () => {
    const s = withSync();
    s.run(`NS.syncNow.mark()`);
    advance(s, 200);
    s.run(`NS.syncNow.tick()`);
    expect(s.run(`return #TIMERS`)).toBe("0");   // only 200s since login, default is 10 minutes
    advance(s, 500);
    s.run(`NS.syncNow.tick()`);
    expect(s.run(`return #TIMERS`)).toBe("1");
  });

  it("never reloads in combat or inside an instance, even at the last second", () => {
    const s = withSync();
    s.run(`NS.syncNow.mark()`);
    advance(s, 1000);
    s.run(`INSTANCE = true; NS.syncNow.tick()`);
    expect(s.run(`return #TIMERS`)).toBe("0");
    s.run(`INSTANCE = false; NS.syncNow.tick()`);
    expect(s.run(`return #TIMERS`)).toBe("1");
    s.run(`COMBAT = true`);            // combat starts during the countdown
    runTimers(s);
    expect(reloads(s)).toBe(0);
  });

  it("members get a banner instead of an automatic reload, and can opt in", () => {
    const s = withSync(false);
    s.run(`NS.syncNow.mark()`);
    advance(s, 1000);
    s.run(`NS.syncNow.tick()`);
    expect(s.run(`return #TIMERS`)).toBe("0");
    expect(reloads(s)).toBe(0);
    s.run(`NS.commandHandlers["sync"]({ "auto", "on", "5" })`);
    expect(s.chat().join("\n")).toContain("Auto-save for Discord is on (at most every 5 minutes");
    s.run(`NS.syncNow.tick()`);
    expect(s.run(`return #TIMERS`)).toBe("1");
  });

  it("auto can be turned off, and /qg sync saves right away", () => {
    const s = withSync();
    s.run(`NS.commandHandlers["sync"]({ "auto", "off" })`);
    s.run(`NS.syncNow.mark()`);
    advance(s, 1000);
    s.run(`NS.syncNow.tick()`);
    expect(s.run(`return #TIMERS`)).toBe("0");
    s.run(`NS.commandHandlers["sync"]({})`);
    expect(reloads(s)).toBe(1);
  });

  it("Core marks data as changed when it logs an event", () => {
    session = newLuaSession();
    session.run(`QuebecGoldDB = nil; NS = {}; MOCK_UNITS = { player = { name = "Kev", buffs = {} } }; time = function() return 5 end`);
    session.load("Core.lua");
    session.load("Compat.lua");
    session.load("Modules/SyncNow.lua");
    session.run(`fire_event("PLAYER_LOGIN"); SlashCmdList["QUEBECGOLD"]("attune Onyxia Key")`);
    expect(session.run(`return tostring(NS.syncNow.isDirty())`)).toBe("true");
  });
});
