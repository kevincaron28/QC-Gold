import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  type ChatInputCommandInteraction
} from "discord.js";
import { commands } from "./commands/index.js";
import { executeHealth } from "./commands/health.js";
import { executeProfile } from "./commands/profile.js";
import { executeCharacter } from "./commands/character.js";
import { executeProfession } from "./commands/profession.js";
import { executeConfig } from "./commands/settings.js";
import { replyWithCommandError } from "./commands/context.js";
import { executeDkp } from "./commands/dkp.js";
import { executeRaid, handleRaidSignupButton, RAID_SIGNUP_PREFIX } from "./commands/raid.js";
import { executeImport } from "./commands/import.js";
import { executeLoot } from "./commands/loot.js";
import { executeApply, executeApplication } from "./commands/application.js";
import { executeImportApply } from "./commands/import-apply.js";
import { executeEpgp } from "./commands/epgp.js";
import { executeReadiness } from "./commands/readiness.js";
import { executeAttunement } from "./commands/attunement.js";
import { executeModeration } from "./commands/moderation.js";
import { executeTag } from "./commands/tag.js";
import { executeWishlist } from "./commands/wishlist.js";
import { executeSelfRoles, handleSelfRoleButton, SELF_ROLE_PREFIX } from "./commands/selfroles.js";
import { EP_AWARD_PREFIX, handleEpAwardButton } from "./commands/ep-award.js";
import { executeWho } from "./commands/who.js";
import { executeWcl } from "./commands/wcl.js";
import { executeCore } from "./commands/core.js";
import { executeInactive } from "./commands/inactive.js";
import { executeExport } from "./commands/export.js";
import { executeGuildHealth } from "./commands/guild-health.js";
import { executePoll, handlePollButton, POLL_PREFIX } from "./commands/poll.js";
import { cleanupDungeonGroups, DUNGEON_GROUP_PREFIX, handleDungeonGroupButton } from "./commands/dungeon-group.js";
import { executeStats, runWeeklyReports } from "./commands/stats.js";
import { executeBank } from "./commands/bank.js";
import { executeTestRaid } from "./commands/testraid.js";
import { executeCraft } from "./commands/craft.js";
import { executeSetup, greetNewGuild, logSetupStatus } from "./commands/setup.js";
import { executeHelp } from "./commands/help.js";
import { executeDungeon } from "./commands/dungeon.js";
import { executeDungeonAdmin } from "./commands/dungeon-admin.js";
import { handleAutocomplete } from "./commands/autocomplete.js";
import { prisma } from "./database.js";
import { runRaidReminders } from "./services/reminders.js";
import { runBackup } from "./services/backup.js";
import { config } from "./config.js";
import { startCompanionApi } from "./companion-api.js";
import { handleMemberJoin, handleMemberLeave, handleWelcomeRoleButton, WELCOME_ROLE_PREFIX } from "./services/housekeeping.js";

// GuildMembers is a privileged intent: it must also be enabled for this bot
// application under "Server Members Intent" in the Discord Developer Portal,
// or login will fail with "Used disallowed intents".
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
startCompanionApi(client);
const handlers = new Collection<string, (interaction: ChatInputCommandInteraction) => Promise<void>>();
handlers.set("health", executeHealth);
handlers.set("profile", executeProfile);
handlers.set("character", executeCharacter);
handlers.set("profession", executeProfession);
handlers.set("config", executeConfig);
handlers.set("dkp", executeDkp);
handlers.set("raid", executeRaid);
handlers.set("import", executeImport);
handlers.set("loot", executeLoot);
handlers.set("apply", executeApply);
handlers.set("application", executeApplication);
handlers.set("import-apply", executeImportApply);
handlers.set("epgp", executeEpgp);
handlers.set("readiness", executeReadiness);
handlers.set("attunement", executeAttunement);
handlers.set("mod", executeModeration);
handlers.set("tag", executeTag);
handlers.set("wishlist", executeWishlist);
handlers.set("selfroles", executeSelfRoles);
handlers.set("who", executeWho);
handlers.set("wcl", executeWcl);
handlers.set("core", executeCore);
handlers.set("inactive", executeInactive);
handlers.set("export", executeExport);
handlers.set("guildhealth", executeGuildHealth);
handlers.set("poll", executePoll);
handlers.set("stats", executeStats);
handlers.set("bank", executeBank);
handlers.set("testraid", executeTestRaid);
handlers.set("craft", executeCraft);
handlers.set("setup", executeSetup);
handlers.set("help", executeHelp);
handlers.set("dungeon", executeDungeon);
handlers.set("dungeon-admin", executeDungeonAdmin);

client.once(Events.ClientReady, (readyClient) => {
  registerCommandsEverywhere().catch((error: unknown) => console.error("Command registration failed", error));
  console.info(`Logged in as ${readyClient.user.tag}`);
  logSetupStatus(readyClient.guilds.cache.values()).catch(() => undefined);
  // Daily database backup to backups/ (keeps 14 days). Runs now if today's
  // file is missing, then checks hourly.
  const backup = () => runBackup(prisma)
    .then((result) => { if (result) console.info(`Backup saved: backups/${result.file} (${result.rows} rows).`); })
    .catch((error: unknown) => console.warn(`Backup skipped, will retry in an hour: ${error instanceof Error ? error.message : String(error)}`));
  void backup();
  setInterval(() => void backup(), 60 * 60 * 1000);
  // Raid reminders: checked every 5 minutes so a "60 minutes before" ping
  // lands within a few minutes of that mark.
  setInterval(() => {
    runRaidReminders(readyClient, prisma).catch((error: unknown) => {
      const text = error instanceof Error ? error.message.split("\n").filter(Boolean).at(-1) : String(error);
      console.warn(`Raid reminder check skipped, will retry in 5 minutes: ${text}`);
    });
  }, 5 * 60 * 1000);
  // Dungeon group voice channels: deleted after a few empty minutes.
  setInterval(() => {
    cleanupDungeonGroups(readyClient).catch((error: unknown) => {
      console.warn(`Dungeon group cleanup skipped: ${error instanceof Error ? error.message : String(error)}`);
    });
  }, 2 * 60 * 1000);
  // Weekly guild report (if enabled): checked hourly.
  setInterval(() => {
    runWeeklyReports(readyClient).catch((error: unknown) => {
      const text = error instanceof Error ? error.message.split("\n").filter(Boolean).at(-1) : String(error);
      console.warn(`Weekly report check skipped, will retry in an hour: ${text}`);
    });
  }, 60 * 60 * 1000);
});

// Bot just added to a server: point whoever invited it at /setup.
client.on(Events.GuildCreate, (guild) => {
  registerCommands(guild.id).catch((error: unknown) => console.error("Registering commands for new guild failed", error));
  greetNewGuild(guild).catch((error: unknown) => console.error("Greeting new guild failed", error));
});

client.on(Events.GuildMemberAdd, async (member) => {
  try {
    await handleMemberJoin(member.guild, member);
  } catch (error) {
    console.error("GuildMemberAdd handling failed", error);
  }
});

client.on(Events.GuildMemberRemove, async (member) => {
  try {
    await handleMemberLeave(member.guild, member);
  } catch (error) {
    console.error("GuildMemberRemove handling failed", error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isAutocomplete()) {
    await handleAutocomplete(interaction);
    return;
  }
  if (interaction.isButton() && interaction.customId.startsWith(WELCOME_ROLE_PREFIX)) {
    await handleWelcomeRoleButton(interaction).catch(async (error: unknown) => {
      console.error("Welcome role button failed", error);
      if (!interaction.replied) await interaction.reply({ content: "That didn't work, try again or ask an officer.", ephemeral: true }).catch(() => undefined);
    });
    return;
  }
  if (interaction.isButton() && interaction.customId.startsWith(POLL_PREFIX)) {
    await handlePollButton(interaction).catch((error: unknown) => console.error("Poll button failed", error));
    return;
  }
  if (interaction.isButton() && interaction.customId.startsWith(DUNGEON_GROUP_PREFIX)) {
    try {
      await handleDungeonGroupButton(interaction);
    } catch (error) {
      const content = error instanceof Error && error.message.length < 200 ? error.message : "Could not update the group.";
      if (!interaction.replied) await interaction.reply({ content, ephemeral: true }).catch(() => undefined);
    }
    return;
  }
  if (interaction.isButton() && interaction.customId.startsWith(RAID_SIGNUP_PREFIX)) {
    try {
      await handleRaidSignupButton(interaction);
    } catch (error) {
      const content = error instanceof Error ? error.message : "Could not update your signup.";
      if (!interaction.replied) await interaction.reply({ content, ephemeral: true }).catch(() => undefined);
    }
    return;
  }
  if (interaction.isButton() && interaction.customId.startsWith(EP_AWARD_PREFIX)) {
    try {
      await handleEpAwardButton(interaction);
    } catch (error) {
      console.error("EP award button failed", error);
      const content = error instanceof Error ? error.message : "Could not record the EP award.";
      if (!interaction.replied) await interaction.reply({ content, ephemeral: true }).catch(() => undefined);
    }
    return;
  }
  if (interaction.isButton() && interaction.customId.startsWith(SELF_ROLE_PREFIX)) {
    try {
      await handleSelfRoleButton(interaction);
    } catch (error) {
      console.error("Self-role button failed", error);
      if (!interaction.replied) {
        await interaction.reply({ content: "Could not update that role. Please try again or contact an officer.", ephemeral: true }).catch(() => undefined);
      }
    }
    return;
  }
  if (!interaction.isChatInputCommand()) return;
  const handler = handlers.get(interaction.commandName);
  if (!handler) {
    await interaction.reply({ content: "That command is not available.", ephemeral: true });
    return;
  }
  try {
    await handler(interaction);
  } catch (error) {
    await replyWithCommandError(interaction, error);
  }
});

async function registerCommands(guildId: string): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, guildId),
    { body: commands.map((command) => command.toJSON()) }
  );
}

// Commands are per-guild, so every server the bot is in needs them registered.
async function registerCommandsEverywhere(): Promise<void> {
  const guildIds = new Set<string>([config.DISCORD_GUILD_ID, ...client.guilds.cache.keys()]);
  for (const guildId of guildIds) {
    await registerCommands(guildId).catch((error: unknown) => console.warn(`Command registration failed for guild ${guildId}`, error));
  }
}

await client.login(config.DISCORD_TOKEN);
