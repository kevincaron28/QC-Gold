// @ts-expect-error luaparse ships no type declarations
import luaparse from "luaparse";
import { describe, expect, it } from "vitest";
import { resolveStandingsPath, standingsToLua } from "../companion/standings.mjs";
import { createEpgpService } from "../src/services/epgp.js";

describe("companion standings file", () => {
  it("finds the addon folder next to the WTF folder", () => {
    const path = resolveStandingsPath({
      watchFile: "C:\\Games\\World of Warcraft\\_forever_\\WTF\\Account\\ME\\SavedVariables\\QuebecGold.lua"
    });
    expect(path?.replace(/\\/g, "/")).toBe("C:/Games/World of Warcraft/_forever_/Interface/AddOns/QuebecGold/Standings.lua");
  });

  it("writes valid Lua even for awkward names", () => {
    const lua = standingsToLua({
      updatedAt: "2026-09-24T00:00:00.000Z",
      standings: [
        { character: "Kévin", main: true, ep: 100, gp: 50, pr: 2 },
        { character: "Bad\"Name\\", main: false, ep: -3, gp: 0, pr: 0 }
      ]
    });
    expect(() => luaparse.parse(lua)).not.toThrow();
    expect(lua).toContain('name = "Kévin", ep = 100, gp = 50, main = true');
  });
});

describe("guild standings", () => {
  it("gives every linked character its member's EP/GP/PR", async () => {
    const database = {
      epgpTransaction: {
        groupBy: async () => [{ memberId: "m1", _sum: { epAmount: 100, gpAmount: 40 } }]
      },
      character: {
        findMany: async () => [
          { name: "Main", memberId: "m1", isMain: true },
          { name: "Alt", memberId: "m1", isMain: false },
          { name: "Newbie", memberId: "m2", isMain: true }
        ]
      }
    };
    const standings = await createEpgpService(database as never).getGuildStandings("g1");
    expect(standings).toEqual([
      { character: "Main", main: true, ep: 100, gp: 40, pr: 2.5 },
      { character: "Alt", main: false, ep: 100, gp: 40, pr: 2.5 },
      { character: "Newbie", main: true, ep: 0, gp: 0, pr: 0 }
    ]);
  });
});
