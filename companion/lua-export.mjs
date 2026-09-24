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
  const object = {};
  let index = 1;
  for (const field of node.fields) {
    if (field.type === "TableKeyString") object[field.key.name] = evaluate(field.value);
    else if (field.type === "TableKey") object[String(evaluate(field.key))] = evaluate(field.value);
    else object[index++] = evaluate(field.value);
  }
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
  const ledger = database.epgp ?? database.dkp ?? {};
  for (const [character, account] of Object.entries(ledger)) {
    for (const [index, entry] of Object.entries(account.ledger ?? {})) {
      const isEpgp = entry.epAmount !== undefined || entry.gpAmount !== undefined;
      transactions.push({
        character,
        realm,
        amount: Number(isEpgp ? (entry.epAmount || entry.gpAmount) : entry.amount),
        type: entry.type === "DEDUCTION" ? "DEDUCTION" : isEpgp ? "IMPORT" : "AWARD",
        reason: String(entry.reason ?? "Quebec Gold addon ledger"),
        sourceRef: `qg:${entry.raid ?? "manual"}:${index}`
      });
    }
  }
  const exportKeys = Object.keys(database.exports ?? {});
  const exportedAt = exportKeys.at(-1) ?? new Date().toISOString();
  return {
    source: "QuebecGold",
    exportedAt,
    transactions,
    readiness: Object.values(database.readiness ?? {}).map((entry) => ({
      ...entry,
      realm
    }))
  };
}
