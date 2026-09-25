/* eslint-disable no-control-regex */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = new URL(".", import.meta.url);
const rootPath = fileURLToPath(root);
const toc = readFileSync(new URL("QuebecGold.toc", root), "utf8");
// 16001 is WoW Forever's interface number (from /dump select(4, GetBuildInfo())).
if (!toc.includes("## Interface: 16001") || !toc.includes("## SavedVariables:")) {
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
  "SendAddonMessage", "SlashCmdList"]) {
  if (!core.includes(required)) throw new Error(`Missing ${required} in Core.lua`);
}
// Since patch 12.0.0 (inherited by WoW Forever) addons cannot register the
// combat log event; attempting it triggers a "blocked from an action only
// available to the Blizzard UI" popup on load.
for (const file of ["Core.lua", "Modules/Casino.lua"]) {
  const source = readFileSync(new URL(file, root), "utf8");
  if (/RegisterEvent\(\s*"COMBAT_LOG_EVENT/.test(source)) {
    throw new Error(`${file} registers a combat log event, which addons are blocked from doing`);
  }
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

const addonFiles = ["Core.lua", "Compat.lua", "Locale.lua", "Standings.lua", "Modules/Casino.lua", "Modules/Sync.lua", "Modules/Sim.lua", "Modules/Bidding.lua", "Modules/Calendar.lua", "Modules/Consumables.lua", "Modules/Digest.lua", "Modules/API.lua", "Modules/Dungeon.lua", "Modules/Minimap.lua"];
for (const file of addonFiles) {
  const source = readFileSync(new URL(file, root), "utf8");
  if (/RegisterEvent\(\s*"COMBAT_LOG_EVENT/.test(source)) {
    throw new Error(`${file} registers a combat log event, which addons are blocked from doing`);
  }
}
// Addon message prefixes are limited to 16 characters.
for (const file of addonFiles) {
  const source = readFileSync(new URL(file, root), "utf8");
  for (const match of source.matchAll(/PREFIX = "([^"]+)"/g)) {
    if (match[1].length > 16) throw new Error(`${file}: addon message prefix "${match[1]}" is over 16 characters`);
  }
}

for (const file of addonFiles) {
  const name = file.replace("/", "\\");
  if (!toc.includes(name)) throw new Error(`${file} is not listed in QuebecGold.toc, so the game would never load it`);
}

// Lua syntax: one broken file stops the whole addon from loading in game.
// luaparse comes with the bot's dependencies (the companion uses it).
let luaparse = null;
try {
  luaparse = (await import("luaparse")).default;
} catch {
  console.warn("luaparse not installed (run npm install in the bot folder); skipping the Lua syntax check.");
}
if (luaparse) {
  for (const file of addonFiles) {
    try {
      luaparse.parse(readFileSync(new URL(file, root), "utf8"), { luaVersion: "5.1" });
    } catch (error) {
      throw new Error(`${file}: Lua syntax error: ${error.message}`);
    }
  }
}

console.log("QuebecGold addon static validation passed.");
