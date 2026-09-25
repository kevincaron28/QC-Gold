import { readFile } from "node:fs/promises";
import luaparse from "luaparse";

function evaluate(node) {
  if (!node) return null;
  if (node.type === "StringLiteral") {
    if (node.value !== null) return node.value;
    const raw = node.raw ?? "";
    if (raw.startsWith("\"")) return JSON.parse(raw);
    return raw.slice(1, -1).replace(/\\(['"])/g, "$1");
  }
  if (node.type === "NumericLiteral" || node.type === "BooleanLiteral") return node.value;
  if (node.type === "NilLiteral") return null;
  if (node.type === "UnaryExpression" && node.operator === "-") return -evaluate(node.argument);
  if (node.type !== "TableConstructorExpression") throw new Error(`Unsupported Lua value: ${node.type}`);

  // WoW's SavedVariables writer always serializes array-like tables with
  // explicit bracketed keys (e.g. `{ [1] = a, [2] = b }`), never the compact
  // `{ a, b }` literal form. Without detecting that, every array field the
  // addon exports (items, findings, professions, consumables, ledger
  // entries, ...) would come out as a plain object with numeric-string keys
  // instead of a real array, which fails every array schema on the bot
  // side. An empty table is ambiguous between "empty array" and "empty
  // object" — resolve it as an array, since every consumer of an object
  // result here only calls Object.entries/Object.values, which behave
  // identically on an empty array.
  if (node.fields.length === 0) return [];

  const entries = [];
  let index = 1;
  for (const field of node.fields) {
    if (field.type === "TableKeyString") entries.push([field.key.name, evaluate(field.value)]);
    else if (field.type === "TableKey") entries.push([String(evaluate(field.key)), evaluate(field.value)]);
    else entries.push([String(index++), evaluate(field.value)]);
  }

  const isArrayLike = entries.every(([key], position) => key === String(position + 1));
  if (isArrayLike) return entries.map(([, value]) => value);

  const object = {};
  for (const [key, value] of entries) object[key] = value;
  return object;
}

function readDatabase(lua) {
  const ast = luaparse.parse(lua);
  const assignment = ast.body.find((statement) =>
    statement.type === "AssignmentStatement" &&
    statement.variables.some((variable) => variable.type === "Identifier" && variable.name === "QuebecGoldDB")
  );
  if (!assignment) throw new Error("QuebecGoldDB was not found in the SavedVariables file.");
  return evaluate(assignment.init[0]);
}

export async function readAddonExport(path, realm) {
  const database = readDatabase((await readFile(path, "utf8")).replace(/^\uFEFF/, ""));
  const transactions = [];
  const epgpTransactions = [];
  // The addon migrates its legacy db.dkp ledger into db.epgp on login, so a
  // fresh SavedVariables file only ever has one or the other populated.
  const usingEpgpLedger = database.epgp !== undefined;
  const ledger = database.epgp ?? database.dkp ?? {};
  for (const [character, account] of Object.entries(ledger)) {
    for (const [index, entry] of Object.entries(account.ledger ?? {})) {
      // Every export carries the whole ledger, so this ref must be stable
      // across exports: the bot skips refs it already imported. Addon v1.2+
      // stamps a unique id on each entry; older entries fall back to
      // character + timestamp + position (the addon never trims the ledger).
      const sourceRef = entry.id
        ? `qg:${entry.id}`
        : `qg:${character}:${entry.at ?? "unknown"}:${entry.by ?? "unknown"}:${index}`;
      let reason = String(entry.reason ?? "").trim();
      if (reason.length < 3) reason = `Quebec Gold addon ledger${reason ? `: ${reason}` : ""}`;
      if (usingEpgpLedger) {
        epgpTransactions.push({
          character,
          realm,
          epAmount: Number(entry.epAmount ?? 0),
          gpAmount: Number(entry.gpAmount ?? 0),
          type: entry.type ?? "ADJUSTMENT",
          reason,
          sourceRef
        });
      } else {
        transactions.push({
          character,
          realm,
          amount: Number(entry.amount),
          type: entry.type === "DEDUCTION" ? "DEDUCTION" : "AWARD",
          reason,
          sourceRef
        });
      }
    }
  }
  const attunements = [];
  for (const [character, entries] of Object.entries(database.attunements ?? {})) {
    for (const [name, entry] of Object.entries(entries ?? {})) {
      attunements.push({ character, realm, name, completed: entry.completed !== false });
    }
  }

  // Peer roster digests are compact status/profession summaries broadcast by
  // other online clients (see the addon README's "Automatic readiness sync"
  // section) rather than a full /qg inspect. They carry no item list, so
  // they're converted into readiness entries with synthesized findings
  // instead of real gear data — this is what lets one officer's export
  // carry a readiness picture for the whole online guild, not just themselves.
  const peerReadiness = Object.entries(database.peerRoster ?? {}).map(([character, entry]) => {
    const professions = String(entry.professions ?? "")
      .split(",")
      .filter(Boolean)
      .map((part) => {
        const [name, skillLevel] = part.split(":");
        return { name, skillLevel: Number(skillLevel) || 0 };
      });
    const findings = [];
    if ((entry.missing ?? 0) > 0) {
      findings.push({
        code: "PEER_MISSING_GEAR",
        severity: "ERROR",
        message: `${entry.missing} required gear slot(s) reported missing by peer sync.`
      });
    }
    if ((entry.minDurability ?? 100) < 50) {
      findings.push({
        code: "PEER_LOW_DURABILITY",
        severity: "WARNING",
        message: `Lowest reported equipment durability: ${entry.minDurability}%.`
      });
    }
    return {
      character,
      realm,
      professions,
      findings,
      inspectedAt: entry.updatedAt
    };
  });

  // Finished in-game raids: explicit attendance marks plus everyone the addon
  // saw in the raid group (db.presence). Still-running raids wait for /qg end.
  const raids = [];
  for (const raid of Object.values(database.raids ?? {})) {
    if (!raid?.id || !raid.startedAt || !raid.endedAt) continue;
    const marked = database.attendance?.[raid.id] ?? {};
    const seen = database.presence?.[raid.id] ?? {};
    const names = new Set([...Object.keys(marked), ...Object.keys(seen)]);
    raids.push({
      ref: raid.id,
      title: String(raid.title || "Raid"),
      startedAt: raid.startedAt,
      endedAt: raid.endedAt,
      players: [...names].sort().map((character) => ({
        character,
        realm,
        ...(marked[character]?.status ? { status: marked[character].status } : {}),
        seen: character in seen
      }))
    });
  }

  // Items given out in game. Rows from before loot ids existed fall back to
  // a ref built from who/what/when, which is just as stable.
  const loot = [];
  for (const row of Object.values(database.loot ?? {})) {
    if (!row?.player || !row.item) continue;
    const item = String(row.item).replace(/\|c[0-9a-fA-F]{8}\|H[^|]*\|h(\[[^\]]*\])\|h\|r/g, "$1");
    loot.push({
      ref: row.id ? `qg-loot:${row.id}` : `qg-loot:${row.player}:${row.at ?? "unknown"}:${item}`,
      character: row.player,
      realm,
      item,
      gp: Math.max(0, Math.trunc(Number(row.cost) || 0)),
      ...(row.at ? { awardedAt: row.at } : {}),
      ...(row.raid ? { raidRef: row.raid } : {}),
      ...(row.boss ? { boss: row.boss } : {})
    });
  }

  // Dungeon runs (addon Modules/Dungeon.lua). The bot validates each run and
  // ignores ones it already has, so exporting all of them every time is safe.
  const dungeonRuns = [];
  for (const run of Object.values(database.dungeon?.runs ?? {})) {
    if (!run?.id || !run.state || !run.instanceId) continue;
    dungeonRuns.push({
      id: String(run.id),
      protocolVersion: Number(run.protocolVersion ?? 1),
      ...(run.addonVersion ? { addonVersion: String(run.addonVersion) } : {}),
      state: String(run.state),
      instanceId: Number(run.instanceId),
      name: String(run.name ?? "Unknown dungeon"),
      difficultyId: Number(run.difficultyId ?? 0),
      ...(run.startedAt ? { startedAt: Math.trunc(Number(run.startedAt)) } : {}),
      ...(run.endedAt ? { endedAt: Math.trunc(Number(run.endedAt)) } : {}),
      ...(run.completedBy ? { completedBy: String(run.completedBy) } : {}),
      ...(run.endReason ? { endReason: String(run.endReason) } : {}),
      ...(run.recorder ? { recorder: String(run.recorder) } : {}),
      reporters: Object.keys(run.reporters ?? {}).length || 1,
      players: Object.entries(run.players ?? {}).map(([character, player]) => ({
        character,
        realm,
        ...(player.class ? { class: String(player.class) } : {}),
        ...(player.role ? { role: String(player.role) } : {}),
        deaths: typeof player.deaths === "number" ? player.deaths : null,
        presentSec: Math.max(0, Math.trunc(Number(player.presentSec) || 0)),
        inGuild: player.inGuild === true
      }))
    });
  }

  // SavedVariables key order is arbitrary; the ISO timestamps sort correctly.
  const exportKeys = Object.keys(database.exports ?? {}).sort();
  const exportedAt = exportKeys.at(-1) ?? new Date().toISOString();
  return {
    source: "QuebecGold",
    exportedAt,
    ...(database.character?.name ? {
      character: {
        name: String(database.character.name),
        realm: String(database.character.realm || realm),
        class: String(database.character.class ?? ""),
        race: String(database.character.race ?? ""),
        level: Number(database.character.level) || 0,
        spec: String(database.character.spec ?? ""),
        professions: Array.isArray(database.character.professions) ? database.character.professions : []
      }
    } : {}),
    transactions,
    epgpTransactions,
    readiness: [
      ...Object.values(database.readiness ?? {}).map((entry) => ({ ...entry, realm })),
      ...peerReadiness
    ],
    attunements,
    raids,
    loot,
    dungeonRuns
  };
}
