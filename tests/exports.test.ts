import { describe, expect, it } from "vitest";
import { buildExport, csvCell, toCsv } from "../src/services/exports.js";

describe("CSV export", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell('He said "hi", then left')).toBe('"He said ""hi"", then left"');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(new Date("2026-10-01T00:00:00Z"))).toBe("2026-10-01T00:00:00.000Z");
  });

  it("defuses spreadsheet formulas typed by players, but keeps negative numbers", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe("\"'=HYPERLINK(\"\"http://evil\"\")\"");
    expect(csvCell("+cmd")).toBe("'+cmd");
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell("-5")).toBe("-5");
  });

  it("builds a header and rows", () => {
    expect(toCsv(["a", "b"], [[1, "x,y"]])).toBe('a,b\n1,"x,y"\n');
  });

  it("exports the roster with one row per character", async () => {
    const database = {
      member: { findMany: async () => [
        { displayName: "Kev", characters: [{ name: "Kevin", realm: "R", className: "Priest", spec: "Shadow", level: 60, race: "Human", isMain: true, lastSeenAt: null }, { name: "Alt", realm: "R", className: "Mage", spec: null, level: 30, race: null, isMain: false, lastSeenAt: null }] },
        { displayName: "Newbie", characters: [] }
      ] }
    };
    const result = await buildExport(database as never, "g", "roster");
    expect(result.rows).toBe(3);
    expect(result.csv.split("\n")[0]).toBe("member,character,realm,class,spec,level,race,main,last_seen");
    expect(result.csv).toContain("Kev,Kevin,R,Priest,Shadow,60,Human,true,");
    expect(result.csv).toContain("Newbie,,,,,,,,");
  });
});
