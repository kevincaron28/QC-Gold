import { describe, expect, it, vi } from "vitest";
import { applyRaidEpProposal, computeRaidEpProposal, raidEpRef } from "../src/services/ep-award.js";

function database(paidRefs: string[] = []) {
  const created: { memberId: string; epAmount: number; sourceRef: string }[] = [];
  return {
    created,
    db: {
      raid: {
        findFirst: vi.fn().mockResolvedValue({
          id: "r1", title: "Molten Core",
          bosses: [{ status: "KILLED" }, { status: "KILLED" }],
          attendance: [
            { memberId: "m1", status: "PRESENT", member: { displayName: "Kev" } },
            { memberId: "m2", status: "LATE", member: { displayName: "Bob" } },
            { memberId: "m3", status: "ABSENT", member: { displayName: "Amy" } }
          ]
        })
      },
      guildSettings: {
        findUnique: vi.fn().mockResolvedValue({ attendanceDkp: 10, lateAttendanceDkp: 5, bossKillDkp: 3, epCompletionBonus: 4 })
      },
      epgpTransaction: {
        findMany: vi.fn().mockResolvedValue(paidRefs.map((sourceRef) => ({ sourceRef }))),
        create: vi.fn().mockImplementation(async ({ data }) => { created.push(data); return data; })
      }
    }
  };
}

describe("raid EP proposal", () => {
  it("adds attendance, per-boss EP, and the full-clear bonus; skips absentees", async () => {
    const { db } = database();
    const proposal = await computeRaidEpProposal(db as never, "g1", "r1");
    expect(proposal.rows.map((row) => [row.name, row.ep])).toEqual([["Kev", 20], ["Bob", 15]]);
  });

  it("never pays the same raid twice", async () => {
    const { db, created } = database([raidEpRef("r1", "m1")]);
    const result = await applyRaidEpProposal(db as never, "g1", "r1", "officer");
    expect(result).toMatchObject({ created: 1, skipped: 1, total: 15 });
    expect(created.map((row) => row.memberId)).toEqual(["m2"]);
    expect(created[0]?.sourceRef).toBe("raid-ep:r1:m2");
  });
});
