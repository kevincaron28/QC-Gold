import { describe, expect, it, vi } from "vitest";
import { buildWelcomeMessage, handleWelcomeRoleButton, welcomeDelivery, welcomeEnabled } from "../src/services/housekeeping.js";

const roles = new Map([
  ["wow", { id: "wow", name: "World of Warcraft" }],
  ["other", { id: "other", name: "Other Game" }]
]);
const guild = { id: "g1", name: "Quebec Gold", memberCount: 42, roles: { cache: roles } };
const base = { welcomeMessageTemplate: null, welcomeRoleIds: [] as string[], welcomeRolePrompt: null };

describe("welcome message", () => {
  it("is on with a channel, or with DM delivery even without one", () => {
    expect(welcomeEnabled({ welcomeDelivery: "CHANNEL", welcomeChannelId: null })).toBe(false);
    expect(welcomeEnabled({ welcomeDelivery: "CHANNEL", welcomeChannelId: "c" })).toBe(true);
    expect(welcomeEnabled({ welcomeDelivery: "DM", welcomeChannelId: null })).toBe(true);
    expect(welcomeDelivery({ welcomeDelivery: "nonsense" })).toBe("CHANNEL");
  });

  it("has no buttons when no roles are offered", () => {
    const message = buildWelcomeMessage(base, guild as never, { id: "u1", username: "Kev" });
    expect(message.components).toEqual([]);
    expect(message.content).toContain("<@u1>");
  });

  it("adds one button per offered role that still exists, carrying the server id", () => {
    const message = buildWelcomeMessage({ ...base, welcomeRoleIds: ["wow", "gone", "other"], welcomeRolePrompt: "Which game?" },
      guild as never, { id: "u1", username: "Kev" });
    const buttons = message.components[0]!.toJSON().components as { custom_id: string; label: string }[];
    expect(buttons.map((b) => [b.label, b.custom_id])).toEqual([
      ["World of Warcraft", "welcomerole:g1:wow"],
      ["Other Game", "welcomerole:g1:other"]
    ]);
    expect(message.embeds?.[0]?.toJSON().description).toBe("Which game?");
  });

  it("refuses roles that are no longer offered", async () => {
    vi.resetModules();
    const reply = vi.fn();
    const interaction = {
      customId: "welcomerole:g1:admin",
      user: { id: "u1" },
      reply,
      client: { guilds: { fetch: vi.fn().mockResolvedValue({ id: "g1", name: "QG", roles: { fetch: vi.fn().mockResolvedValue({ id: "admin", name: "Admin" }) } }) } }
    };
    const housekeeping = await import("../src/services/housekeeping.js");
    // Settings offer only "wow"; a crafted "admin" id must be rejected.
    vi.spyOn(housekeeping.welcomeGuildService, "ensureGuild").mockResolvedValue({ id: "db-g1" } as never);
    vi.spyOn(housekeeping.welcomeGuildService, "getSettings").mockResolvedValue({ welcomeRoleIds: ["wow"] } as never);
    await housekeeping.handleWelcomeRoleButton(interaction as never);
    expect(reply.mock.calls[0]?.[0].content).toContain("isn't offered anymore");
    void handleWelcomeRoleButton;
  });
});
