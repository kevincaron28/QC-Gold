/* eslint-disable no-control-regex */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL(".", import.meta.url);
const rootPath = fileURLToPath(root);
const toc = readFileSync(new URL("QuebecGold.toc", root), "utf8");
if (!toc.includes("## Interface: 11200") || !toc.includes("## SavedVariables: QuebecGoldDB")) {
  throw new Error("TOC is missing interface or SavedVariables metadata");
}
for (const file of readdirSync(rootPath)) {
  if (file.endsWith(".lua") || file.endsWith(".toc") || file.endsWith(".md")) {
    const text = readFileSync(new URL(file, root), "utf8");
    if (/[^\x00-\x7F]/.test(text)) throw new Error(`Non-ASCII content in ${file}`);
  }
}
const lua = readFileSync(new URL("QuebecGold.lua", root), "utf8");
for (const required of ["PLAYER_LOGIN", "GUILD_ROSTER_UPDATE", "CHAT_MSG_LOOT",
  "COMBAT_LOG_EVENT_UNFILTERED", "SendAddonMessage", "SlashCmdList"]) {
  if (!lua.includes(required)) throw new Error(`Missing ${required}`);
}
if (!lua.includes("SavedVariables") || !lua.includes("QuebecGoldDB")) {
  throw new Error("Lua addon does not reference its SavedVariables database");
}
console.log("QuebecGold addon static validation passed.");
