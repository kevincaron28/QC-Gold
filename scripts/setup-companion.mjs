// One-click companion setup: `npm run companion:setup`.
//
// Finds the WoW install and account, suggests the realm from the game's own
// folders, creates (or reuses) the upload token, and writes it to BOTH
// .env.local (for the bot) and companion/companion.config.json (for the
// companion) so the two always match. Asks only when there's a real choice;
// `--yes` takes the first option everywhere. `--wow "D:\\Games\\World of
// Warcraft"` points it at an unusual install folder.
import { randomBytes } from "node:crypto";
import { copyFile, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const ENV_FILE = ".env.local";
const CONFIG_FILE = join("companion", "companion.config.json");
const args = process.argv.slice(2);
const autoYes = args.includes("--yes");
const wowArg = args.includes("--wow") ? args[args.indexOf("--wow") + 1] : null;

const rl = createInterface({ input: stdin, output: stdout });

async function exists(path) {
  try { await stat(path); return true; } catch { return false; }
}

async function dirs(path) {
  try {
    return (await readdir(path, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

async function choose(question, options) {
  if (options.length === 1 || autoYes) {
    console.log(`${question} ${options[0]}`);
    return options[0];
  }
  console.log(question);
  options.forEach((option, index) => console.log(`  ${index + 1}. ${option}`));
  for (;;) {
    const answer = (await rl.question(`Type a number (1-${options.length}) and press Enter: `)).trim();
    const picked = options[Number(answer) - 1];
    if (picked) return picked;
    console.log("That isn't one of the numbers above, try again.");
  }
}

async function ask(question, fallback) {
  if (autoYes) return fallback;
  const answer = (await rl.question(`${question} [${fallback}]: `)).trim();
  return answer || fallback;
}

// Game folders that contain WTF\Account: the install root, or a flavor
// folder inside it (_retail_, _classic_, _forever_, ...).
async function findGameFolders() {
  const roots = wowArg ? [wowArg] : [];
  for (const drive of ["C", "D", "E", "F"]) {
    for (const base of ["Program Files (x86)", "Program Files", "Games", "Blizzard", ""]) {
      roots.push(join(`${drive}:\\`, base, "World of Warcraft"));
    }
  }
  const found = [];
  for (const root of roots) {
    if (!(await exists(root))) continue;
    if (await exists(join(root, "WTF", "Account"))) found.push(root);
    for (const flavor of await dirs(root)) {
      if (flavor.startsWith("_") && await exists(join(root, flavor, "WTF", "Account"))) found.push(join(root, flavor));
    }
  }
  return [...new Set(found)];
}

function parseEnv(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return values;
}

function setEnvValue(text, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^\\s*${key}\\s*=.*$`, "m");
  if (pattern.test(text)) return text.replace(pattern, line);
  return `${text.replace(/\s*$/, "")}\n${line}\n`;
}

async function main() {
  console.log("\n=== Guilded companion setup ===\n");

  const games = await findGameFolders();
  if (games.length === 0) {
    console.log("I couldn't find World of Warcraft. Run this again with the folder, for example:");
    console.log('  npm run companion:setup -- --wow "D:\\Games\\World of Warcraft"');
    process.exitCode = 1;
    return;
  }
  const game = await choose("WoW folder:", games);

  const accountsDir = join(game, "WTF", "Account");
  const accounts = (await dirs(accountsDir)).filter((name) => name !== "SavedVariables");
  if (accounts.length === 0) {
    console.log(`No WoW account folders in ${accountsDir}. Log in to the game once, then run this again.`);
    process.exitCode = 1;
    return;
  }
  const account = await choose("WoW account (the one you raid on):", accounts);

  // Realm folders sit next to SavedVariables inside the account folder.
  const realms = (await dirs(join(accountsDir, account))).filter((name) => name !== "SavedVariables");
  const realm = realms.length
    ? await choose("Realm (must match your characters' realm in /character add):", realms)
    : await ask("Realm name", "WoW Forever");

  const watchFile = join(accountsDir, account, "SavedVariables", "Guilded.lua");
  if (!(await exists(watchFile))) {
    console.log("\nNote: Guilded.lua doesn't exist yet. That's fine; it appears after you log in with the addon and /reload once.");
  }

  const envText = (await exists(ENV_FILE)) ? await readFile(ENV_FILE, "utf8") : "";
  const env = parseEnv(envText);
  const guildId = env.DISCORD_GUILD_ID;
  if (!guildId) {
    console.log(`\n${ENV_FILE} has no DISCORD_GUILD_ID. Set up the bot first (README "Setup"), then run this again.`);
    process.exitCode = 1;
    return;
  }
  const existingToken = env.COMPANION_UPLOAD_TOKEN;
  const token = existingToken && existingToken.length >= 32 && !existingToken.startsWith("replace-")
    ? existingToken
    : randomBytes(24).toString("hex");
  const port = env.COMPANION_API_PORT || "8787";

  if (token !== existingToken) {
    if (envText) await copyFile(ENV_FILE, `${ENV_FILE}.bak`);
    await writeFile(ENV_FILE, setEnvValue(envText, "COMPANION_UPLOAD_TOKEN", token));
    console.log(`\nSaved a new upload token in ${ENV_FILE} (old file kept as ${ENV_FILE}.bak).`);
  } else {
    console.log(`\nKept the existing upload token from ${ENV_FILE}.`);
  }

  if (await exists(CONFIG_FILE)) await copyFile(CONFIG_FILE, `${CONFIG_FILE}.bak`);
  const config = {
    watchFile,
    realm,
    uploadUrl: `http://127.0.0.1:${port}/api/v1/addon-imports`,
    guildDiscordId: guildId,
    uploadToken: token
  };
  await writeFile(CONFIG_FILE, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`Wrote ${CONFIG_FILE}.`);

  console.log("\nAll set. Next:");
  if (token !== existingToken) console.log("  1. Restart the bot (close its window and use the desktop shortcut) so it picks up the new token.");
  console.log(`  ${token !== existingToken ? "2" : "1"}. Double-click start-companion.bat (or run: npm run companion:watch) and leave it open while you play.`);
  console.log("");
}

try {
  await main();
} finally {
  rl.close();
}
