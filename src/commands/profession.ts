import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { guildService, requireGuildContext } from "./context.js";

export const professionCommand = new SlashCommandBuilder()
  .setName("profession")
  .setDescription("Manage your character professions.")
  .addSubcommand((subcommand) => subcommand
    .setName("set")
    .setDescription("Set a profession and skill level.")
    .addStringOption((option) => option.setName("character").setDescription("Character name").setRequired(true))
    .addStringOption((option) => option.setName("profession").setDescription("Profession name").setRequired(true))
    .addIntegerOption((option) => option.setName("skill").setDescription("Skill level").setMinValue(1).setMaxValue(300).setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName("list")
    .setDescription("List your recorded professions."));

export async function executeProfession(interaction: ChatInputCommandInteraction): Promise<void> {
  const context = await requireGuildContext(interaction);
  if (!context) return;
  const subcommand = interaction.options.getSubcommand();
  const characters = await guildService.listCharacters(context.memberId);
  if (subcommand === "list") {
    const lines = characters.flatMap((character) =>
      character.professions.map((skill) => `${character.name}: ${skill.profession} ${skill.skillLevel}`)
    );
    await interaction.reply({ content: lines.length ? lines.join("\n") : "No professions recorded.", ephemeral: true });
    return;
  }

  const characterName = interaction.options.getString("character", true);
  const character = characters.find((candidate) => candidate.name.toLowerCase() === characterName.toLowerCase());
  if (!character) throw new Error("That character is not linked to your profile.");
  const profession = interaction.options.getString("profession", true).trim();
  const skill = interaction.options.getInteger("skill", true);
  await guildService.setProfession(character.id, profession, skill);
  await interaction.reply({ content: `Recorded ${profession} ${skill} for ${character.name}.`, ephemeral: true });
}
