import { describe, expect, it } from "vitest";
import { commands } from "../src/commands/index.js";

interface OptionJson { name: string; required?: boolean; options?: OptionJson[] }

function orderingProblems(options: OptionJson[] | undefined, path: string): string[] {
  const problems: string[] = [];
  let sawOptional = false;
  for (const option of options ?? []) {
    if (option.options) problems.push(...orderingProblems(option.options, `${path}/${option.name}`));
    else if (option.required) {
      if (sawOptional) problems.push(`${path}/${option.name}: required option after an optional one`);
    } else sawOptional = true;
  }
  return problems;
}

describe("command payloads", () => {
  it("serialize, and never put a required option after an optional one (Discord rejects the whole registration)", () => {
    const problems = commands.flatMap((command) => {
      const json = command.toJSON() as unknown as OptionJson;
      return orderingProblems(json.options, command.name);
    });
    expect(problems).toEqual([]);
  });
});

describe("command registration", () => {
  it("registers each top-level command exactly once", () => {
    const names = commands.map((command) => command.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain("import");
    expect(names).toContain("loot");
    expect(names).toContain("apply");
    expect(names).toContain("application");
    for (const name of ["mod", "tag", "wishlist", "selfroles"]) expect(names).toContain(name);
  });
});
