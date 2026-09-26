import { describe, expect, it } from "vitest";
import { parseEpField } from "../src/commands/core-wizard.js";

describe("core wizard EP form", () => {
  it("empty keeps the guild default, numbers are read, anything else is refused", () => {
    expect(parseEpField("")).toBeNull();
    expect(parseEpField("  ")).toBeNull();
    expect(parseEpField("20")).toBe(20);
    expect(parseEpField(" 0 ")).toBe(0);
    expect(() => parseEpField("ten")).toThrow(/not a whole number/);
    expect(() => parseEpField("-5")).toThrow(/not a whole number/);
    expect(() => parseEpField("1.5")).toThrow(/not a whole number/);
  });
});
