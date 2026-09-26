import { readFileSync, writeFileSync, readdirSync } from "node:fs";

// Changes the product's DISPLAY name everywhere people see it (bot embeds, addon
// window and chat text, TOC title, docs). It does not touch identifiers
// (addon folder QuebecGold, saved variable QuebecGoldDB, /qg), so saved data and
// guild settings keep working.
//   node scripts/rebrand.mjs "New Name" [--dry-run]
const [, , newName, flag] = process.argv;
if (!newName) { console.error('Usage: node scripts/rebrand.mjs "New Name" [--dry-run]'); process.exit(1); }
const dry = flag === "--dry-run";
const OLD = "Quebec Gold";

const files = [
  "src/brand.ts", "src/i18n.ts", "README.md", "COMMANDS.md", "CHANGELOG.md", "SECURITY.md", "LICENSE",
  "addon/QuebecGold/QuebecGold.toc", "addon/QuebecGold/README.md",
  "companion/README.md", "companion-app/package.json", "companion-app/renderer/index.html", "companion-app/main.cjs",
  "docs/DEPLOY_ORACLE.md", "docs/RELEASE_CURSEFORGE.md",
  ...readdirSync("addon/QuebecGold").filter((f) => f.endsWith(".lua")).map((f) => `addon/QuebecGold/${f}`),
  ...readdirSync("addon/QuebecGold/Modules").filter((f) => f.endsWith(".lua")).map((f) => `addon/QuebecGold/Modules/${f}`)
];

let changed = 0;
for (const file of files) {
  let text;
  try { text = readFileSync(file, "utf8"); } catch { continue; }
  const count = text.split(OLD).length - 1;
  if (count === 0) continue;
  changed += count;
  console.log(`${file}: ${count}`);
  if (!dry) writeFileSync(file, text.split(OLD).join(newName), "utf8");
}
console.log(`${dry ? "Would change" : "Changed"} ${changed} mention(s) of "${OLD}" to "${newName}".`);
console.log("Also set by hand: the bot's username and avatar in the Discord developer portal, the CurseForge project name and logo.");
