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
import { executeRaid } from "./commands/raid.js";
import { executeImport } from "./commands/import.js";
import { executeLoot } from "./commands/loot.js";
import { executeApply, executeApplication } from "./commands/application.js";
import { executeImportApply } from "./commands/import-apply.js";
import { executeEpgp } from "./commands/epgp.js";
import { executeReadiness } from "./commands/readiness.js";
import { config } from "./config.js";
import { startCompanionApi } from "./companion-api.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
startCompanionApi();
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

client.once(Events.ClientReady, (readyClient) => {
  console.info(`Logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
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

async function registerCommands(): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID),
    { body: commands.map((command) => command.toJSON()) }
  );
}

await registerCommands();
await client.login(config.DISCORD_TOKEN);
