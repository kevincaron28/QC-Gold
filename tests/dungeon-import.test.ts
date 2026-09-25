import { describe, expect, it } from "vitest";
import { importDungeonRuns } from "../src/services/dungeon-import.js";

// In-memory stand-in for the few Prisma queries importDungeonRuns makes.
interface StoredPlayer { character: string; memberId: string | null; deaths: number | null }
interface StoredRun {
  id: string; runRef: string; instanceId: number; difficultyId: number; state: string; valid: boolean;
  invalidReason: string | null; startedAt: Date | null; endedAt: Date | null; durationSec: number | null; players: StoredPlayer[];
}

function fakeTx() {
  const runs: StoredRun[] = [];
  const points: { memberId: string; amount: number; source: string; runId: string }[] = [];
  const completedWith = (where: { instanceId: number; valid?: boolean; state?: string }) => (run: StoredRun) =>
    run.instanceId === where.instanceId && (where.valid === undefined || run.valid === where.valid)
    && (where.state === undefined || run.state === where.state);
  const tx = {
    guildSettings: { findUnique: async () => null },
    dungeonSeason: {
      findFirst: async () => null,
      create: async () => ({ id: "season-1" })
    },
    dungeonRun: {
      findUnique: async ({ where }: { where: { guildId_runRef: { runRef: string } } }) =>
        runs.find((run) => run.runRef === where.guildId_runRef.runRef) ?? null,
      findMany: async ({ where }: { where: { instanceId: number; valid?: boolean; state?: string; startedAt?: { gte: Date; lte: Date }; players?: { some: { memberId: string } } } }) =>
        runs.filter(completedWith(where)).filter((run) => {
          if (where.startedAt && !(run.startedAt && run.startedAt >= where.startedAt.gte && run.startedAt <= where.startedAt.lte)) return false;
          if (where.players && !run.players.some((player) => player.memberId === where.players?.some.memberId)) return false;
          return true;
        }),
      findFirst: async ({ where }: { where: { instanceId: number; difficultyId: number; valid: boolean; state: string } }) =>
        runs.filter(completedWith(where)).filter((run) => run.difficultyId === where.difficultyId && run.durationSec !== null)
          .sort((a, b) => (a.durationSec ?? 0) - (b.durationSec ?? 0))[0] ?? null,
      create: async ({ data }: { data: Omit<StoredRun, "id" | "players"> & { players: { create: StoredPlayer[] } } }) => {
        const run = { ...data, id: `run-${runs.length + 1}`, players: data.players.create };
        runs.push(run);
        return run;
      }
    },
    dungeonPointTransaction: {
      create: async ({ data }: { data: { memberId: string; amount: number; source: string; runId: string } }) => {
        points.push(data);
        return data;
      }
    }
  };
  return { tx: tx as unknown as Parameters<typeof importDungeonRuns>[0], runs, points };
}

const characters = ["Kev", "Bob", "Amy", "Zed", "Liz"].map((name) => ({ name, realm: "Forever", memberId: `m-${name.toLowerCase()}` }));
const now = new Date("2026-09-25T20:00:00Z");
const start = Math.floor(new Date("2026-09-25T18:00:00Z").getTime() / 1000);

function run(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id, protocolVersion: 1, state: "COMPLETED", instanceId: 36, name: "Deadmines", difficultyId: 1,
    startedAt: start, endedAt: start + 1500, reporters: 1,
    players: characters.map((character) => ({ character: character.name, realm: "Forever", deaths: 0, presentSec: 1500, inGuild: true })),
    ...overrides
  };
}

const total = (points: { memberId: string; amount: number }[], memberId: string) =>
  points.filter((row) => row.memberId === memberId).reduce((sum, row) => sum + row.amount, 0);

describe("importDungeonRuns", () => {
  it("stores a completed run and awards points to every linked player", async () => {
    const { tx, runs, points } = fakeTx();
    const summary = await importDungeonRuns(tx, "g1", [run("run-a")], characters, "officer", "imp1", now);
    expect(runs).toHaveLength(1);
    expect(summary.results[0]).toMatchObject({ valid: true, durationSec: 1500, guildRecord: false });
    // completion 50 + no deaths 25 + first completion 25 + full guild group 20
    expect(total(points, "m-kev")).toBe(120);
    expect(new Set(points.map((row) => row.memberId)).size).toBe(5);
  });

  it("skips a run it already has, and the same run reported by a second member", async () => {
    const { tx, runs, points } = fakeTx();
    await importDungeonRuns(tx, "g1", [run("run-a")], characters, "officer", "imp1", now);
    const before = points.length;
    const again = await importDungeonRuns(tx, "g1", [run("run-a"), run("r1-other-reporter", { startedAt: start + 40, endedAt: start + 1530 })],
      characters, "officer", "imp2", now);
    expect(again.duplicates).toBe(2);
    expect(runs).toHaveLength(1);
    expect(points.length).toBe(before);
  });

  it("keeps invalid and malformed runs out of the points", async () => {
    const { tx, runs, points } = fakeTx();
    const summary = await importDungeonRuns(tx, "g1", [run("fast", { endedAt: start + 60 }), { id: "broken" }], characters, "officer", "imp1", now);
    expect(summary.malformed).toBe(1);
    expect(summary.results[0]).toMatchObject({ valid: false });
    expect(runs[0]?.valid).toBe(false);
    expect(points).toHaveLength(0);
  });

  it("gives no points for abandoned runs", async () => {
    const { tx, points } = fakeTx();
    const summary = await importDungeonRuns(tx, "g1", [run("left", { state: "ABANDONED" })], characters, "officer", "imp1", now);
    expect(summary.results[0]).toMatchObject({ state: "ABANDONED", points: 0 });
    expect(points).toHaveLength(0);
  });

  it("detects guild and personal records and reduces repeat points in the same week", async () => {
    const { tx, points } = fakeTx();
    await importDungeonRuns(tx, "g1", [run("run-a")], characters, "officer", "imp1", now);
    const later = start + 3600;
    const faster = await importDungeonRuns(tx, "g1", [run("run-b", { startedAt: later, endedAt: later + 1200 })], characters, "officer", "imp2", now);
    const result = faster.results[0];
    expect(result).toMatchObject({ guildRecord: true, previousGuildBest: 1500 });
    expect(result?.personalRecords).toHaveLength(5);
    const second = points.filter((row) => row.runId === "run-2" && row.memberId === "m-kev");
    expect(second.some((row) => row.source === "rule:firstCompletion")).toBe(false);
    // Second clear this week is worth half: (50 + 25 + 15 + 25 + 20) / 2, rounded per rule.
    expect(second.reduce((sum, row) => sum + row.amount, 0)).toBeLessThan(120);
  });

  it("records unlinked players without giving them points", async () => {
    const { tx, points } = fakeTx();
    const players = [...run("run-a").players.slice(0, 4), { character: "Pugsy", realm: "Forever", deaths: 0, presentSec: 1500, inGuild: false }];
    const summary = await importDungeonRuns(tx, "g1", [run("run-a", { players })], characters, "officer", "imp1", now);
    expect(summary.results[0]?.unlinked).toEqual(["Pugsy"]);
    expect(points.some((row) => row.source === "rule:fullGuildGroup")).toBe(false);
  });
});
