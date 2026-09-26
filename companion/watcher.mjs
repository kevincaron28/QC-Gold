import { readFile } from "node:fs/promises";
import { watch } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { setInterval } from "node:timers";
import { readAddonExport } from "./lua-export.mjs";
import { writeStandings } from "./standings.mjs";

const config = JSON.parse(await readFile(resolve("companion/companion.config.json"), "utf8"));
if (typeof config.uploadToken !== "string" || config.uploadToken.length < 32) {
  throw new Error("companion.config.json must contain an uploadToken of at least 32 characters.");
}

let timer;

async function upload() {
  const exported = config.watchFile.toLowerCase().endsWith(".lua")
    ? await readAddonExport(config.watchFile, config.realm)
    : JSON.parse(await readFile(config.watchFile, "utf8"));
  // The saved data belongs to one WoW guild. If this companion is set up for
  // a specific one (wowGuild in the config) and the file is from another
  // (e.g. you played an alt in a different guild), don't send it to this Discord.
  if (config.wowGuild && exported.wowGuild && exported.wowGuild !== config.wowGuild) {
    console.log(`Skipped: the saved data belongs to "${exported.wowGuild}", this companion is for "${config.wowGuild}".`);
    return;
  }
  const response = await fetch(config.uploadUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.uploadToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ guildDiscordId: config.guildDiscordId, export: exported })
  });
  const body = await response.json();
  if (response.ok) {
    console.log(body.autoApplied
      ? `Uploaded and applied automatically (${body.autoApplied.epgp} ledger entries, ${body.autoApplied.discovered} new characters).`
      : `Uploaded ${body.transactionCount} ledger entries. Apply on Discord with: /import-apply id:${body.importId}`);
    // The bot may have just linked characters or changed points: refresh the in-game standings soon.
    setTimeout(() => void refreshStandings(), 5000);
  } else if (response.status === 409) {
    console.log("Nothing new since the last upload.");
  } else {
    console.error(`Upload failed (${response.status}):`, body.error);
  }
}

function scheduleUpload() {
  clearTimeout(timer);
  timer = setTimeout(() => upload().catch((error) => console.error("Watcher failed:", error)), 1000);
}

// Watch the folder, not the file: WoW replaces SavedVariables files on save,
// and a watch on the file itself can stop firing after the first replace.
const watchedName = basename(config.watchFile).toLowerCase();
watch(dirname(config.watchFile), (_event, filename) => {
  if (filename && filename.toString().toLowerCase() === watchedName) scheduleUpload();
});
console.log(`Watching ${config.watchFile}`);

// Keep the addon's Standings.lua in step with the bot. The game only reads
// it on login or /reload, so this makes the newest numbers ready for the next
// reload: every 2 minutes (standingsIntervalMinutes in the config), and right
// after each upload. The file is only rewritten when something changed.
async function refreshStandings() {
  try {
    const { path, count, unchanged } = await writeStandings(config);
    if (!unchanged) console.log(`Wrote EPGP standings for ${count} character(s) to ${path}.`);
  } catch (error) {
    console.error("Standings update failed:", error instanceof Error ? error.message : error);
  }
}
await refreshStandings();
setInterval(refreshStandings, Math.max(1, Number(config.standingsIntervalMinutes) || 2) * 60 * 1000);
