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
import { executeAttunement } from "./commands/attunement.js";
import { executeModeration } from "./commands/moderation.js";
import { executeTag } from "./commands/tag.js";
import { executeWishlist } from "./commands/wishlist.js";
import { executeSelfRoles, handleSelfRoleButton, SELF_ROLE_PREFIX } from "./commands/selfroles.js";
import { prisma } from "./database.js";
import { runRecruitmentPosts } from "./services/recruitment.js";
import { config } from "./config.js";
import { startCompanionApi } from "./companion-api.js";
import { handleMemberJoin, handleMemberLeave } from "./services/housekeeping.js";

// GuildMembers is a privileged intent: it must also be enabled for this bot
// application under "Server Members Intent" in the Discord Developer Portal,
// or login will fail with "Used disallowed intents".
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
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
handlers.set("attunement", executeAttunement);
handlers.set("mod", executeModeration);
handlers.set("tag", executeTag);
handlers.set("wishlist", executeWishlist);
handlers.set("selfroles", executeSelfRoles);

client.once(Events.ClientReady, (readyClient) => {
  console.info(`Logged in as ${readyClient.user.tag}`);
  // Scheduled recruitment posts: checked every 10 minutes while the bot is running.
  setInterval(() => {
    runRecruitmentPosts(readyClient, prisma).catch((error: unknown) => console.error("Recruitment check failed", error));
  }, 10 * 60 * 1000);
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

async function registerCommands(): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID),
    { body: commands.map((command) => command.toJSON()) }
  );
}

await registerCommands();
await client.login(config.DISCORD_TOKEN);
