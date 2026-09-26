import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createEngine, validateConfig } from "./engine.mjs";

// Command-line companion (start-companion.bat). The desktop app in
// companion-app/ does the same job with a window and a tray icon.
const config = JSON.parse(await readFile(resolve("companion/companion.config.json"), "utf8"));
const problems = validateConfig(config);
if (problems.length > 0) throw new Error(`companion.config.json: ${problems[0]}`);

const engine = createEngine(config, {
  onLog: ({ level, message }) => (level === "error" ? console.error : console.log)(message)
});
await engine.start();
