import { readFile } from "node:fs/promises";
import { watch } from "node:fs";
import { resolve } from "node:path";
import { readAddonExport } from "./lua-export.mjs";

const config = JSON.parse(await readFile(resolve("companion/companion.config.json"), "utf8"));
if (typeof config.uploadToken !== "string" || config.uploadToken.length < 32) {
  throw new Error("companion.config.json must contain an uploadToken of at least 32 characters.");
}

let timer;

async function upload() {
  const exported = config.watchFile.toLowerCase().endsWith(".lua")
    ? await readAddonExport(config.watchFile, config.realm)
    : JSON.parse(await readFile(config.watchFile, "utf8"));
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
    console.log(`Uploaded ${body.transactionCount} transactions (${body.importId}).`);
  } else if (response.status !== 409) {
    console.error(`Upload failed (${response.status}):`, body.error);
  }
}

function scheduleUpload() {
  clearTimeout(timer);
  timer = setTimeout(() => upload().catch((error) => console.error("Watcher failed:", error)), 1000);
}

watch(config.watchFile, scheduleUpload);
console.log(`Watching ${config.watchFile}`);
