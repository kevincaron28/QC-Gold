import type { AutocompleteInteraction, GuildMember } from "discord.js";
import { prisma } from "../database.js";
import { hasPermission } from "../permissions.js";
import {
  applicationChoices, auctionChoices, bankChoices, craftChoices, epgpEntryChoices, importChoices,
  raidChoices, raidStatusesFor, type Choice
} from "../services/autocomplete.js";
import { dungeonChoices } from "../services/dungeon-stats.js";
import { guildService } from "./context.js";

// Routes every autocomplete request (see setAutocomplete(true) on ID
// options) to the right list. Must answer within 3 seconds, so any error
// just returns an empty list rather than failing the interaction.
export async function handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  let choices: Choice[] = [];
  try {
    if (!interaction.guildId || !interaction.guild) return;
    const guild = await guildService.ensureGuild(interaction.guildId, interaction.guild.name);
    const settings = await guildService.getSettings(guild.id);
    const focused = interaction.options.getFocused(true);
    const query = String(focused.value ?? "");
    const command = interaction.commandName;
    const subcommand = interaction.options.getSubcommand(false);
    const member = await guildService.ensureMember(guild.id, interaction.user.id, interaction.user.username);
    const timeZone = settings?.timezone ?? "America/Toronto";
    const language = settings?.language ?? "en";

    if (focused.name === "raid") {
      choices = await raidChoices(prisma, {
        guildId: guild.id,
        query,
        statuses: command === "testraid" ? ["PLANNED", "ACTIVE"] : raidStatusesFor(command === "raid" ? subcommand : null),
        testOnly: command === "testraid",
        timeZone,
        language
      });
    } else if (focused.name === "auction") {
      choices = await auctionChoices(prisma, guild.id, query);
    } else if (command === "bank" && focused.name === "id") {
      // Officers handling requests see everyone's; members see their own.
      const officer = subcommand === "handle" && !!interaction.member && hasPermission(interaction.member as GuildMember, "officer");
      choices = await bankChoices(prisma, guild.id, query, officer ? null : member.id);
    } else if (command === "craft" && focused.name === "id" && subcommand) {
      choices = await craftChoices(prisma, guild.id, query, subcommand, member.id);
    } else if (command === "epgp" && focused.name === "entry") {
      choices = await epgpEntryChoices(prisma, guild.id, query);
    } else if (command === "application" && focused.name === "id") {
      choices = await applicationChoices(prisma, guild.id, query);
    } else if (command === "dungeon" && focused.name === "dungeon") {
      choices = await dungeonChoices(prisma, guild.id, query);
    } else if (command === "import-apply" && focused.name === "id") {
      choices = await importChoices(prisma, guild.id, query);
    }
  } catch (error) {
    console.warn(`Autocomplete failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  await interaction.respond(choices).catch(() => undefined);
}
