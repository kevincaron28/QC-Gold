import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";

export const healthCommand = new SlashCommandBuilder()
  .setName("health")
  .setDescription("Check whether Quebec Gold Bot is online.");

export async function executeHealth(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.reply({ content: "⚜️ Quebec Gold Bot is online.", ephemeral: true });
}
