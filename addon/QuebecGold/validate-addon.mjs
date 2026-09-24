/* eslint-disable no-control-regex */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = new URL(".", import.meta.url);
const rootPath = fileURLToPath(root);
const toc = readFileSync(new URL("QuebecGold.toc", root), "utf8");
if (!toc.includes("## Interface: 11200") || !toc.includes("## SavedVariables:")) {
  throw new Error("TOC is missing interface or SavedVariables metadata");
}

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

for (const file of walk(rootPath)) {
  if (file.endsWith(".lua") || file.endsWith(".toc") || file.endsWith(".md")) {
    const text = readFileSync(file, "utf8");
    if (/[^\x00-\x7F]/.test(text)) throw new Error(`Non-ASCII content in ${file}`);
  }
}

const core = readFileSync(new URL("Core.lua", root), "utf8");
for (const required of ["PLAYER_LOGIN", "GUILD_ROSTER_UPDATE", "CHAT_MSG_LOOT",
  "COMBAT_LOG_EVENT_UNFILTERED", "SendAddonMessage", "SlashCmdList"]) {
  if (!core.includes(required)) throw new Error(`Missing ${required} in Core.lua`);
}
if (!core.includes("QuebecGoldDB")) {
  throw new Error("Core.lua does not reference its SavedVariables database");
}

const casino = readFileSync(new URL("Modules/Casino.lua", root), "utf8");
if (!casino.includes("QuebecGoldCasinoDB")) {
  throw new Error("Casino.lua does not reference its SavedVariables database");
}
if (!casino.includes("commandHandlers")) {
  throw new Error("Casino.lua does not register into Core.lua's command extension point");
}

console.log("QuebecGold addon static validation passed.");
