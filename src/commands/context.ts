import type { ChatInputCommandInteraction } from "discord.js";
import { prisma } from "../database.js";
import { createGuildService } from "../services/guild.js";

export const guildService = createGuildService(prisma);

export async function requireGuildContext(
  interaction: ChatInputCommandInteraction
): Promise<{ guildId: string; memberId: string } | null> {
  if (!interaction.guild || !interaction.guildId || !interaction.member) {
    await interaction.reply({
      content: "This command can only be used inside the Quebec Gold Discord server.",
      ephemeral: true
    });
    return null;
  }

  const guild = await guildService.ensureGuild(interaction.guildId, interaction.guild.name);
  const member = await guildService.ensureMember(
    guild.id,
    interaction.user.id,
    interaction.member.user.username
  );
  return { guildId: guild.id, memberId: member.id };
}

export async function replyWithCommandError(
  interaction: ChatInputCommandInteraction,
  error: unknown
): Promise<void> {
  console.error("Command failed", error);
  const content = error instanceof Error && error.message.length < 200
    ? error.message
    : "The command could not be completed. Please try again or contact an officer.";
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp({ content, ephemeral: true });
  } else {
    await interaction.reply({ content, ephemeral: true });
  }
}
