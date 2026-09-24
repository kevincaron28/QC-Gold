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
      const sourceRef = `qg:${entry.raid ?? "manual"}:${index}`;
      const reason = String(entry.reason ?? "Quebec Gold addon ledger");
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

  const exportKeys = Object.keys(database.exports ?? {});
  const exportedAt = exportKeys.at(-1) ?? new Date().toISOString();
  return {
    source: "QuebecGold",
    exportedAt,
    transactions,
    epgpTransactions,
    readiness: [
      ...Object.values(database.readiness ?? {}).map((entry) => ({ ...entry, realm })),
      ...peerReadiness
    ],
    attunements
  };
}
