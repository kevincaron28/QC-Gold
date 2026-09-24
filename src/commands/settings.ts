import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { permissionRoles, hasPermission } from "../permissions.js";
import { guildService, requireGuildContext } from "./context.js";

export const configCommand = new SlashCommandBuilder()
  .setName("config")
  .setDescription("View or update Quebec Gold guild settings.")
  .addSubcommand((subcommand) => subcommand
    .setName("view")
    .setDescription("View current guild settings."))
  .addSubcommand((subcommand) => subcommand
    .setName("set")
    .setDescription("Update one guild setting.")
    .addStringOption((option) => option
      .setName("setting")
      .setDescription("Setting to update")
      .setRequired(true)
      .addChoices(
        { name: "Attendance DKP", value: "attendanceDkp" },
        { name: "Late attendance DKP", value: "lateAttendanceDkp" },
        { name: "Boss kill DKP", value: "bossKillDkp" },
        { name: "Minimum bid", value: "minimumBid" },
        { name: "Bid increment", value: "bidIncrement" },
        { name: "Auction duration (seconds)", value: "auctionDurationSec" }
      ))
    .addIntegerOption((option) => option.setName("value").setDescription("New non-negative value").setMinValue(0).setRequired(true)));

export async function executeConfig(interaction: ChatInputCommandInteraction): Promise<void> {
  const context = await requireGuildContext(interaction);
  if (!context) return;
  const subcommand = interaction.options.getSubcommand();
  const settings = await guildService.getSettings(context.guildId);
  if (!settings) throw new Error("Guild settings have not been initialized.");
  if (subcommand === "view") {
    await interaction.reply({
      content: [
        `Attendance: ${settings.attendanceDkp} DKP`,
        `Late attendance: ${settings.lateAttendanceDkp} DKP`,
        `Boss kill: ${settings.bossKillDkp} DKP`,
        `Minimum bid: ${settings.minimumBid} DKP`,
        `Bid increment: ${settings.bidIncrement} DKP`,
        `Auction duration: ${settings.auctionDurationSec}s`
      ].join("\n"),
      ephemeral: true
    });
    return;
  }

  if (!interaction.guild || !interaction.member || !hasPermission(interaction.member as Parameters<typeof hasPermission>[0], "officer")) {
    await interaction.reply({
      content: `Only members with the ${permissionRoles.officer} role can change settings.`,
      ephemeral: true
    });
    return;
  }

  const setting = interaction.options.getString("setting", true) as keyof typeof settings;
  const value = interaction.options.getInteger("value", true);
  if (setting === "id" || setting === "guildId" || setting === "createdAt" || setting === "updatedAt") {
    throw new Error("That setting cannot be changed.");
  }
  await guildService.updateSettings(context.guildId, { [setting]: value });
  await interaction.reply({ content: `Updated ${setting} to ${value}.`, ephemeral: true });
}
