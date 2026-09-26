import { afterEach, describe, expect, it } from "vitest";
import { newLuaSession, type LuaSession } from "./harness.js";

let session: LuaSession | undefined;
afterEach(() => { session?.close(); session = undefined; });

function withTooltip(standingRow = "{ ep = 30, gp = 10, pr = 3 }"): LuaSession {
  session = newLuaSession();
  session.run(`
    STANDINGS = { Ray = ${standingRow}, Amy = { ep = 50, gp = 10, pr = 5 }, Bob = { ep = 1, gp = 10, pr = 0.1 } }
    INSIGHTS = {
      ["thunderfury blessed blade of the windseeker"] = { gp = 120, n = 3, wn = 5, wish = { { "Amy", 1 }, { "Bob", 2 } } },
      ["lonely ring"] = { gp = 40, n = 1, wn = 0, wish = {} }
    }
    NS = {
      isSecret = function() return false end,
      playerName = function() return "Ray" end,
      getDb = function() return { standings = { players = STANDINGS } } end,
      getStanding = function(name) return STANDINGS[name] end,
      getItemInsight = function(key) return INSIGHTS[key] end,
      moduleActive = function() return true end
    }
  `);
  session.load("Modules/Tooltip.lua");
  return session;
}

const lines = (s: LuaSession, name: string) => JSON.parse(s.run(`local out = {}; for i, l in ipairs(NS.tooltip.lines(${JSON.stringify(name)})) do out[i] = string.format("%q", l) end; return "[" .. table.concat(out, ",") .. "]"`)) as string[];

describe("Tooltip.lua", () => {
  it("normalizes item names like the bot's item keys", () => {
    const s = withTooltip();
    expect(s.run(`return NS.tooltip.itemKey("  Thunderfury, Blessed Blade of the  Windseeker ")`)).toBe("thunderfury blessed blade of the windseeker");
    expect(s.run(`return tostring(NS.tooltip.itemKey(""))`)).toBe("nil");
  });

  it("shows who wants the item, the usual GP and your priority with rank", () => {
    const s = withTooltip();
    expect(lines(s, "Thunderfury, Blessed Blade of the Windseeker")).toEqual([
      "Wanted by Amy (high), Bob (medium) +3 more",
      "Usually costs about 120 GP (3 awards)",
      "Your PR is 3.00 (#2 of 3)"
    ]);
  });

  it("says nothing about an item with no data, and singular award text", () => {
    const s = withTooltip();
    expect(lines(s, "Plain Sword")).toEqual([]);
    expect(lines(s, "Lonely Ring")).toEqual(["Usually costs about 40 GP (1 award)", "Your PR is 3.00 (#2 of 3)"]);
  });

  it("leaves out the PR line when you have no standing", () => {
    const s = withTooltip("nil");
    expect(lines(s, "Lonely Ring")).toEqual(["Usually costs about 40 GP (1 award)"]);
  });

  it("adds the lines to a tooltip once, and not when the module is off", () => {
    const s = withTooltip();
    s.run(`
      ADDED = {}
      TIP = { GetItem = function() return "Lonely Ring", "link" end, AddLine = function(_, text) ADDED[#ADDED + 1] = text end, Show = function() end }
      NS.tooltip.decorate(TIP)
      NS.tooltip.decorate(TIP)
    `);
    expect(s.run(`return #ADDED`)).toBe("2");
    expect(s.run(`return ADDED[1]`)).toBe("Guilded: Usually costs about 40 GP (1 award)");
    s.run(`ADDED = {}; TIP.guildedDone = nil; NS.moduleActive = function() return false end; NS.tooltip.decorate(TIP)`);
    expect(s.run(`return #ADDED`)).toBe("0");
  });
});
