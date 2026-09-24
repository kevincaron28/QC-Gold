import { readFileSync, mkdtempSync, cpSync, rmSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const addonDir = "addon/QuebecGold";
const toc = readFileSync(join(addonDir, "QuebecGold.toc"), "utf8");
const versionMatch = toc.match(/^## Version:\s*(\S+)/m);
if (!versionMatch) throw new Error("Could not find ## Version in QuebecGold.toc");
const version = versionMatch[1];

const staging = mkdtempSync(join(tmpdir(), "quebecgold-zip-"));
const stagingAddon = join(staging, "QuebecGold");

// validate-addon.mjs is a dev-only sanity check (see the file itself); it has
// no place in what guild members download and run in WoW.
cpSync(addonDir, stagingAddon, {
  recursive: true,
  filter: (src) => !src.replace(/\\/g, "/").endsWith("/validate-addon.mjs")
});

const distDir = "dist";
if (!existsSync(distDir)) mkdirSync(distDir);
const zipName = `QuebecGold-v${version}.zip`;
const zipPath = join(distDir, zipName);
if (existsSync(zipPath)) rmSync(zipPath);

console.log(`Building ${zipPath} from addon version ${version}...`);
const result = spawnSync("powershell", [
  "-NoProfile", "-Command",
  `Compress-Archive -Path '${stagingAddon}' -DestinationPath '${zipPath}'`
], { stdio: "inherit" });

rmSync(staging, { recursive: true, force: true });

if (result.status !== 0) {
  console.error("Zip build failed.");
  process.exit(1);
}
console.log(`Built ${zipPath}. Attach this to a GitHub release tagged v${version}.`);
