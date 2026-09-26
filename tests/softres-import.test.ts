import { describe, expect, it } from "vitest";
import { createSoftresImportService, parseCsv, parseSoftresCsv, softresReport } from "../src/services/softres-import.js";

const HEADER = "Item Name,Item ID,From,Raider Name,Raider Class,Raider Spec,Raider Note,Extra Reserves,Date";
const REAL = `${HEADER}\nAncient Cornerstone Grimoire,17067,Onyxia,Ray,Priest,Holy,,0,2026-09-26 21:36:24\n`;

describe("SoftRes CSV", () => {
  it("reads the real export row", () => {
    expect(parseSoftresCsv(REAL)).toEqual({
      rows: [{ item: "Ancient Cornerstone Grimoire", itemId: "17067", from: "Onyxia", raider: "Ray", className: "Priest" }],
      skipped: 0
    });
  });

  it("copes with quotes, commas in names, CRLF and a BOM", () => {
    const text = `﻿${HEADER}\r\n"Ashkandi, Greatsword of the Brotherhood",19364,Nefarian,Bob,Warrior,Fury,"likes ""it""",0,2026\r\n`;
    expect(parseCsv(text)[1]![0]).toBe("Ashkandi, Greatsword of the Brotherhood");
    expect(parseSoftresCsv(text).rows[0]).toMatchObject({ item: "Ashkandi, Greatsword of the Brotherhood", raider: "Bob" });
  });

  it("gives an empty list for a header-only file and skips half-empty rows", () => {
    expect(parseSoftresCsv(`${HEADER}\n`).rows).toEqual([]);
    expect(parseSoftresCsv(`${HEADER}\n,1,X,Ann,Mage,,,0,\nSword,2,X,,Mage,,,0,\n`)).toEqual({ rows: [], skipped: 2 });
  });

  it("refuses the item setup file and other CSVs with a clear message", () => {
    expect(() => parseSoftresCsv("itemId,Item,hard reserved,note,classes,specs,disable class restrictions\n")).toThrow(/item setup file/);
    expect(() => parseSoftresCsv("a,b\n1,2\n")).toThrow(/not look like a SoftRes/);
  });
});

function fakeDb(characters: { id: string; name: string; realm: string }[]) {
  const wishlist = new Map<string, { id: string; characterId: string; itemKey: string; itemName: string; priority: number }>();
  let next = 1;
  return {
    wishlist,
    db: {
      character: { findMany: async () => characters },
      wishlistEntry: {
        findUnique: async ({ where }: { where: { characterId_itemKey: { characterId: string; itemKey: string } } }) =>
          wishlist.get(`${where.characterId_itemKey.characterId}|${where.characterId_itemKey.itemKey}`) ?? null,
        create: async ({ data }: { data: { characterId: string; itemKey: string; itemName: string; priority: number } }) => {
          const row = { id: `w${next++}`, ...data };
          wishlist.set(`${data.characterId}|${data.itemKey}`, row);
          return row;
        },
        update: async ({ where, data }: { where: { id: string }; data: { priority: number; itemName: string } }) => {
          for (const row of wishlist.values()) if (row.id === where.id) Object.assign(row, data);
        }
      }
    }
  };
}

describe("SoftRes import", () => {
  const chars = [{ id: "c1", name: "Ray", realm: "Forever" }, { id: "c2", name: "Bob", realm: "Forever" }, { id: "c3", name: "Bob", realm: "Other" }];

  it("adds reserves as high-priority wishlist entries and reports who is not linked", async () => {
    const { db, wishlist } = fakeDb(chars);
    const summary = await createSoftresImportService(db as never).apply("g1", parseSoftresCsv(`${REAL}Onyxia Hide Backpack,17966,Onyxia,Ghost,Rogue,,,0,\n`));
    expect(summary).toMatchObject({ added: 1, players: 1, unmatched: [{ name: "Ghost", reserves: 1 }] });
    expect(wishlist.get("c1|ancient cornerstone grimoire")).toMatchObject({ priority: 1, itemName: "Ancient Cornerstone Grimoire" });
    expect(softresReport(summary)).toMatch(/Not linked.*Ghost/);
  });

  it("running it twice changes nothing; a different priority updates", async () => {
    const { db, wishlist } = fakeDb(chars);
    const service = createSoftresImportService(db as never);
    await service.apply("g1", parseSoftresCsv(REAL));
    expect(await service.apply("g1", parseSoftresCsv(REAL))).toMatchObject({ added: 0, unchanged: 1 });
    expect(await service.apply("g1", parseSoftresCsv(REAL), 2)).toMatchObject({ updated: 1 });
    expect(wishlist.get("c1|ancient cornerstone grimoire")?.priority).toBe(2);
  });

  it("does not guess between two characters with the same name", async () => {
    const { db } = fakeDb(chars);
    const summary = await createSoftresImportService(db as never).apply("g1", parseSoftresCsv(`${HEADER}\nSword,1,X,Bob,Mage,,,0,\n`));
    expect(summary).toMatchObject({ added: 0, unmatched: [{ name: "Bob", reserves: 1 }] });
  });

  it("rejects a bad priority", async () => {
    await expect(createSoftresImportService(fakeDb([]).db as never).apply("g1", parseSoftresCsv(REAL), 9)).rejects.toThrow(/Priority/);
  });
});
