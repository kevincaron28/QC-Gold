import { describe, expect, it } from "vitest";
import { commands } from "../src/commands/index.js";

describe("command registration", () => {
  it("registers each top-level command exactly once", () => {
    const names = commands.map((command) => command.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain("import");
    expect(names).toContain("loot");
    expect(names).toContain("apply");
    expect(names).toContain("application");
  });
});
