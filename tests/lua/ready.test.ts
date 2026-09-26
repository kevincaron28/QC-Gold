import { afterEach, describe, expect, it } from "vitest";
import { newLuaSession, type LuaSession } from "./harness.js";

let session: LuaSession | undefined;
afterEach(() => { session?.close(); session = undefined; });

const NOW = Date.UTC(2026, 8, 26, 12, 0, 0) / 1000;

// A raid of five: Kev (me), Amy (ready), Bob (addon says no flask, old data), Cy (offline), Dee (no addon, hidden buffs).
function withRaid(): LuaSession {
  session = newLuaSession();
  session.run(String.raw`
    NOW = ${NOW}
    GetServerTime = function() return NOW end
    MEMBERS = { "Kev", "Amy", "Bob", "Cy", "Dee" }
    ONLINE = { Kev = true, Amy = true, Bob = true, Cy = false, Dee = true }
    function IsInRaid() return true end
    function IsInGroup() return true end
    function GetNumGroupMembers() return #MEMBERS end
    -- raid1..raidN and party1..party4 (party n is member n + 1) both resolve to the same five people.
    function SLOT(unit) local r = tonumber(string.match(unit, "^raid(%d+)$")); if r then return r end local p = tonumber(string.match(unit, "^party(%d+)$")); return p and p + 1 or nil end
    function UnitExists(unit) local i = SLOT(unit); return i ~= nil and MEMBERS[i] ~= nil end
    function UnitName(unit) if unit == "player" then return "Kev" end local i = SLOT(unit); return i and MEMBERS[i] end
    function UnitIsConnected(unit) local i = SLOT(unit); return i and ONLINE[MEMBERS[i]] end
    LIVE = {
      Kev = { readable = true, elixirs = {}, flask = "Flask of the Titans", food = "Well Fed" },
      Amy = { readable = true, elixirs = {}, flask = "Flask of Power", food = "Well Fed" },
      Bob = { readable = true, elixirs = {}, food = "Well Fed" },
      Dee = { readable = false, elixirs = {} }
    }
    UNIT_TO_NAME = function(unit) if unit == "player" then return "Kev" end local i = SLOT(unit); return i and MEMBERS[i] end
    SENT = {}
    CHAT = {}
    C_ChatInfo = { SendChatMessage = function(text, channel) CHAT[#CHAT + 1] = channel .. ":" .. text end, RegisterAddonMessagePrefix = function() end, SendAddonMessage = function() end }
    DB = {
      readiness = { Kev = { status = "READY", inspectedAt = "2026-09-26T11:59:00Z", findings = {} } },
      peerRoster = {
        Amy = { status = "READY", missing = 0, minDurability = 100, flags = "", seenAt = NOW - 60 },
        Bob = { status = "PARTIAL", missing = 0, minDurability = 100, flags = "NOFLASK,ENCH:Chest+Legs", seenAt = NOW - 90 * 60 },
        Cy = { status = "READY", missing = 0, minDurability = 100, flags = "", seenAt = NOW - 60 }
      }
    }
    NS = {
      L = function(text) return text end,
      isSecret = function() return false end,
      normalizeName = function(n) return n end,
      playerName = function() return "Kev" end,
      isOfficer = function() return true end,
      getDb = function() return DB end,
      message = function(text) CHAT_LOG = CHAT_LOG or {}; CHAT_LOG[#CHAT_LOG + 1] = text end,
      send = function(text, channel) SENT[#SENT + 1] = channel .. ":" .. text end,
      commandHandlers = {}, commandHelp = {},
      consumables = {
        scanUnit = function(unit) return LIVE[UNIT_TO_NAME(unit)] or { readable = false, elixirs = {} } end,
        hasElixirOrFlask = function(r) return r.flask ~= nil or #r.elixirs > 0 end
      }
    }
  `);
  session.load("Modules/Ready.lua");
  return session;
}

const rows = (s: LuaSession) => s.run(`local out = {}; for _, r in ipairs(NS.ready.collect().rows) do out[#out + 1] = r.name .. "=" .. r.status .. "[" .. table.concat(r.reasons, ";") .. "]" end; return table.concat(out, " ")`);

describe("Ready.lua", () => {
  it("turns an ISO time into seconds", () => {
    const s = withRaid();
    expect(s.run(`return NS.ready.epoch("1970-01-01T00:00:00Z")`)).toBe("0");
    expect(s.run(`return NS.ready.epoch("2026-09-26T12:00:00Z")`)).toBe(String(NOW));
    expect(s.run(`return tostring(NS.ready.epoch("nonsense"))`)).toBe("nil");
  });

  it("lists the group worst first, with the reasons", () => {
    const s = withRaid();
    expect(rows(s)).toBe("Bob=PARTIAL[no enchant: Chest, Legs;no flask;data 90 min old] Cy=NODATA[offline] Dee=NODATA[no addon data] Amy=READY[] Kev=READY[]");
  });

  it("counts them and says it in one line", () => {
    const s = withRaid();
    expect(s.run(`return NS.ready.summary(NS.ready.collect())`)).toBe("2 ready, 1 with issues, 0 not ready, 2 no data");
  });

  it("fresh buffs replace what an addon shared earlier", () => {
    const s = withRaid();
    s.run(`DB.peerRoster.Bob.flags = "NOFLASK,NOFOOD"; LIVE.Bob = { readable = true, elixirs = {}, flask = "Flask of Power", food = "Well Fed" }; DB.peerRoster.Bob.seenAt = NOW`);
    expect(rows(s)).toContain("Bob=READY[]");
  });

  it("a missing food seen live makes a player Issues even without an addon", () => {
    const s = withRaid();
    s.run(`LIVE.Dee = { readable = true, elixirs = {}, flask = "Flask of Power" }`);
    expect(rows(s)).toContain("Dee=PARTIAL[no food]");
  });

  it("empty gear slots or a NOT_READY report are Not ready and sort first", () => {
    const s = withRaid();
    s.run(`DB.peerRoster.Amy = { status = "NOT_READY", missing = 2, minDurability = 15, flags = "", seenAt = NOW }`);
    expect(rows(s).startsWith("Amy=NOT_READY[2 empty slot(s);durability 15%]")).toBe(true);
  });

  it("outside a raid, flask and food are not required", () => {
    const s = withRaid();
    s.run(`function IsInRaid() return false end; function IsInGroup() return true end; DB.peerRoster.Bob.flags = ""; DB.peerRoster.Bob.seenAt = NOW; LIVE.Bob = { readable = true, elixirs = {} }`);
    expect(s.run(`local p = NS.ready.collect(); return tostring(p.inRaid) .. tostring(p.inGroup)`)).toBe("falsetrue");
    expect(s.run(`local out = {}; for _, r in ipairs(NS.ready.collect().rows) do if r.name == "Bob" then out[#out + 1] = r.status end end; return out[1]`)).toBe("READY");
  });

  it("solo: shows just you", () => {
    const s = withRaid();
    s.run(`function IsInRaid() return false end; function IsInGroup() return false end`);
    expect(s.run(`local p = NS.ready.collect(); return #p.rows .. ":" .. tostring(p.inGroup)`)).toBe("1:false");
  });

  it("asks every addon in the group to check, once per 20 seconds", () => {
    const s = withRaid();
    s.run(`NS.ready.ask(); NS.ready.ask()`);
    expect(s.run(`return #SENT`)).toBe("1");
    expect(s.run(`return SENT[1]:sub(1, 14)`)).toBe("RAID:READYREQ|");
    s.run(`NOW = NOW + 25; NS.ready.ask()`);
    expect(s.run(`return #SENT`)).toBe("2");
    s.run(`function IsInRaid() return false end; function IsInGroup() return false end; NOW = NOW + 60; NS.ready.ask()`);
    expect(s.run(`return #SENT`)).toBe("2");
  });

  it("only officers, the group leader and assistants can use it", () => {
    const s = withRaid();
    expect(s.run(`return tostring(NS.ready.canView())`)).toBe("true");
    s.run(`NS.isOfficer = function() return false end`);
    expect(s.run(`return tostring(NS.ready.canView())`)).toBe("false");
    s.run(`NS.commandHandlers["ready"]({})`);
    expect(s.chat().join(" ")).toContain("Only officers and group leaders");
    s.run(`function UnitIsGroupAssistant(unit) return unit == "player" end`);
    expect(s.run(`return tostring(NS.ready.canView())`)).toBe("true");
    s.run(`function UnitIsGroupAssistant() return false end; function UnitIsGroupLeader(unit) return unit == "Amy" end`);
    expect(s.run(`return tostring(NS.ready.isRequester("Amy")) .. tostring(NS.ready.isRequester("Bob"))`)).toBe("truefalse");
  });

  it("posts a summary and the problems to the raid, only for those who may", () => {
    const s = withRaid();
    s.run(`NS.ready.post()`);
    expect(s.run(`return CHAT[1]`)).toBe("RAID:[Guilded] 2 ready, 1 with issues, 0 not ready, 2 no data");
    expect(s.run(`return CHAT[2]`)).toBe("RAID:[Guilded] Bob (no enchant: Chest, Legs, no flask, data 90 min old)");
    s.run(`CHAT = {}; NS.isOfficer = function() return false end; NS.ready.post()`);
    expect(s.run(`return #CHAT`)).toBe("0");
  });

  it("splits a long problem list over several lines", () => {
    const s = withRaid();
    const lines = JSON.parse(s.run(`
      local result = { rows = {}, counts = { READY = 0, PARTIAL = 30, NOT_READY = 0, NODATA = 0 } }
      for i = 1, 30 do result.rows[i] = { name = "Player" .. i, status = "PARTIAL", reasons = { "no flask", "no food" } } end
      local out = {}
      for i, l in ipairs(NS.ready.postLines(result)) do out[i] = string.format("%q", l) end
      return "[" .. table.concat(out, ",") .. "]"`)) as string[];
    expect(lines.length).toBeGreaterThan(2);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(255);
  });

  it("/guilded ready prints the summary and who needs attention", () => {
    const s = withRaid();
    s.run(`NS.commandHandlers["ready"]({})`);
    const text = s.chat().join("\n");
    expect(text).toContain("2 ready, 1 with issues, 0 not ready, 2 no data");
    expect(text).toContain("Bob: Issues - no enchant: Chest, Legs, no flask, data 90 min old");
    expect(text).not.toContain("Amy:");
  });
});
