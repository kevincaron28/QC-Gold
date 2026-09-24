import { healthCommand } from "./health.js";
import { profileCommand } from "./profile.js";
import { characterCommand } from "./character.js";
import { professionCommand } from "./profession.js";
import { configCommand } from "./settings.js";
import { dkpCommand } from "./dkp.js";
import { raidCommand } from "./raid.js";
import { importCommand } from "./import.js";
import { lootCommand } from "./loot.js";
import { applicationCommand, applyCommand } from "./application.js";
import { importApplyCommand } from "./import-apply.js";
import { epgpCommand } from "./epgp.js";
import { readinessCommand } from "./readiness.js";
import { attunementCommand } from "./attunement.js";
import { moderationCommand } from "./moderation.js";
import { tagCommand } from "./tag.js";
import { wishlistCommand } from "./wishlist.js";
import { selfRolesCommand } from "./selfroles.js";

export const commands = [
  healthCommand,
  profileCommand,
  characterCommand,
  professionCommand,
  configCommand,
  dkpCommand,
  raidCommand,
  importCommand,
  lootCommand,
  applyCommand,
  applicationCommand,
  importApplyCommand
  , epgpCommand
  , readinessCommand
  , attunementCommand
  , moderationCommand
  , tagCommand
  , wishlistCommand
  , selfRolesCommand
];

const commandNames = commands.map((command) => command.name);
if (new Set(commandNames).size !== commandNames.length) {
  throw new Error(`Duplicate Discord command name detected: ${commandNames.join(", ")}`);
}
