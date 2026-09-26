import { readFileSync, mkdtempSync, cpSync, rmSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const addonDir = "addon/Guilded";
const toc = readFileSync(join(addonDir, "Guilded.toc"), "utf8");
const versionMatch = toc.match(/^## Version:\s*(\S+)/m);
if (!versionMatch) throw new Error("Could not find ## Version in Guilded.toc");
const version = versionMatch[1];

const staging = mkdtempSync(join(tmpdir(), "guilded-zip-"));
const stagingAddon = join(staging, "Guilded");

// validate-addon.mjs is a dev-only sanity check (see the file itself); it has
// no place in what guild members download and run in WoW.
cpSync(addonDir, stagingAddon, {
  recursive: true,
  filter: (src) => !src.replace(/\\/g, "/").endsWith("/validate-addon.mjs")
});

const distDir = "dist";
if (!existsSync(distDir)) mkdirSync(distDir);
const zipName = `Guilded-v${version}.zip`;
const zipPath = join(distDir, zipName);
if (existsSync(zipPath)) rmSync(zipPath);

console.log(`Building ${zipPath} from addon version ${version}...`);
// Windows PowerShell 5.1's Compress-Archive writes backslash paths, which
// CurseForge and non-Windows unzip tools mishandle. Windows' own bsdtar writes
// a normal zip with forward slashes.
const tar = join(process.env.SystemRoot ?? "C:/Windows", "System32", "tar.exe");
const result = spawnSync(existsSync(tar) ? tar : "tar", ["-a", "-c", "-f", zipPath, "-C", staging, "Guilded"], { stdio: "inherit" });

rmSync(staging, { recursive: true, force: true });

if (result.status !== 0) {
  console.error("Zip build failed.");
  process.exit(1);
}
console.log(`Built ${zipPath}. Attach this to a GitHub release tagged v${version}.`);
