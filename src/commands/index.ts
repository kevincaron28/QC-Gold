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
import { whoCommand } from "./who.js";
import { wclCommand } from "./wcl.js";
import { coreCommand } from "./core.js";
import { inactiveCommand } from "./inactive.js";
import { exportCommand } from "./export.js";
import { guildHealthCommand } from "./guild-health.js";
import { pollCommand } from "./poll.js";
import { statsCommand } from "./stats.js";
import { bankCommand } from "./bank.js";
import { testRaidCommand } from "./testraid.js";
import { craftCommand } from "./craft.js";
import { setupCommand } from "./setup.js";
import { helpCommand } from "./help.js";
import { dungeonCommand } from "./dungeon.js";
import { dungeonAdminCommand } from "./dungeon-admin.js";

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
  , whoCommand
  , wclCommand
  , coreCommand
  , inactiveCommand
  , exportCommand
  , guildHealthCommand
  , pollCommand
  , statsCommand
  , bankCommand
  , testRaidCommand
  , craftCommand
  , setupCommand
  , helpCommand
  , dungeonCommand
  , dungeonAdminCommand
];

const commandNames = commands.map((command) => command.name);
if (new Set(commandNames).size !== commandNames.length) {
  throw new Error(`Duplicate Discord command name detected: ${commandNames.join(", ")}`);
}
