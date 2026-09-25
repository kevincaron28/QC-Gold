import { afterEach, describe, expect, it } from "vitest";
import { newLuaSession, type LuaSession } from "./harness.js";

let session: LuaSession | undefined;
afterEach(() => { session?.close(); session = undefined; });

function withAutoInvite(): LuaSession {
  session = newLuaSession();
  session.run(String.raw`
    DB = { roster = { Old = {} } }
    INVITED = {}
    NOW = 1000
    time = function() return NOW end
    function CanGuildInvite() return true end
    GuildInvite = function(name) INVITED[#INVITED + 1] = name end
    NS = {
      isSecret = function() return false end,
      normalizeName = function(n) return (string.gsub(string.match(n, "^([^%-]+)") or n, "^%l", string.upper)) end,
      isOfficer = function() return true end,
      now = function() return "2026-10-01T20:00:00Z" end,
      getDb = function() return DB end,
      message = function(text) CHAT_LOG = CHAT_LOG or {}; CHAT_LOG[#CHAT_LOG + 1] = text end,
      commandHandlers = {}, commandHelp = {}
    }
  `);
  session.load("Modules/AutoInvite.lua");
  return session;
}

const whisper = (s: LuaSession, text: string, who: string) => s.run(`fire_event("CHAT_MSG_WHISPER", ${JSON.stringify(text)}, ${JSON.stringify(who)}); return #INVITED`);
const command = (s: LuaSession, line: string) => s.run(`local a = {}; for w in string.gmatch(${JSON.stringify(line)}, "%S+") do a[#a + 1] = w end; NS.commandHandlers["autoinvite"](a)`);

describe("AutoInvite.lua", () => {
  it("is off until an officer turns it on, then invites whoever whispers the phrase", () => {
    const s = withAutoInvite();
    expect(whisper(s, "ginv", "Amy-Realm")).toBe("0");
    command(s, "on");
    expect(whisper(s, "  GINV ", "Amy-Realm")).toBe("1");
    expect(s.run(`return INVITED[1]`)).toBe("Amy-Realm");
    expect(whisper(s, "hello there", "Bob-Realm")).toBe("1");
  });

  it("uses a custom phrase and can be turned off", () => {
    const s = withAutoInvite();
    command(s, "on join us please");
    expect(whisper(s, "ginv", "Amy-Realm")).toBe("0");
    expect(whisper(s, "join us please", "Amy-Realm")).toBe("1");
    command(s, "off");
    expect(whisper(s, "join us please", "Cy-Realm")).toBe("1");
  });

  it("skips known guild members, repeats within the hour, combat, non-officers and rate-limit overflow", () => {
    const s = withAutoInvite();
    command(s, "on");
    expect(whisper(s, "ginv", "Old-Realm")).toBe("0");
    whisper(s, "ginv", "Amy-Realm");
    expect(whisper(s, "ginv", "Amy-Realm")).toBe("1");
    s.run(`NOW = NOW + 3601`);
    expect(whisper(s, "ginv", "Amy-Realm")).toBe("2");
    s.run(`fire_event("PLAYER_REGEN_DISABLED")`);
    expect(whisper(s, "ginv", "Bob-Realm")).toBe("2");
    s.run(`fire_event("PLAYER_REGEN_ENABLED"); NS.isOfficer = function() return false end`);
    expect(whisper(s, "ginv", "Bob-Realm")).toBe("2");
    s.run(`NS.isOfficer = function() return true end`);
    const before = Number(s.run(`return #INVITED`));
    for (let i = 0; i < 20; i++) whisper(s, "ginv", `Player${String.fromCharCode(97 + i)}-Realm`);
    // At most 15 invites in any hour.
    expect(Number(s.run(`return #INVITED`)) - before).toBeLessThanOrEqual(14);
  });

  it("only officers can change the setting, and status lists recent invites", () => {
    const s = withAutoInvite();
    s.run(`NS.isOfficer = function() return false end`);
    command(s, "on");
    expect(s.chat().join("\n")).toContain("Only officers can use auto-invite");
    s.run(`NS.isOfficer = function() return true end`);
    command(s, "on");
    whisper(s, "ginv", "Amy-Realm");
    command(s, "status");
    expect(s.chat().join("\n")).toContain('Auto-invite is on, phrase "ginv". 1 recent invite(s).');
  });
});
