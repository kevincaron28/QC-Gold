import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { prisma } from "../database.js";
import { findProfessionHolders, professionCoverage } from "../services/profession-search.js";
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
    .setDescription("List your recorded professions."))
  .addSubcommand((subcommand) => subcommand
    .setName("who")
    .setDescription("Find guild characters with a profession, highest skill first.")
    .addStringOption((option) => option.setName("profession").setDescription("Profession, e.g. Alchemy (partial names work)").setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName("coverage")
    .setDescription("How many characters have each profession, and who is highest."));

// Discord messages are capped at 2000 characters.
function fit(lines: string[], header: string): string {
  let text = header;
  for (const [index, line] of lines.entries()) {
    if (text.length + line.length + 1 > 1900) return `${text}\n…and ${lines.length - index} more`;
    text += `\n${line}`;
  }
  return text;
}

export async function executeProfession(interaction: ChatInputCommandInteraction): Promise<void> {
  const context = await requireGuildContext(interaction);
  if (!context) return;
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "who") {
    const query = interaction.options.getString("profession", true);
    const holders = await findProfessionHolders(prisma, context.guildId, query);
    const lines = holders.map((holder) =>
      `**${holder.character}**${holder.isMain ? "" : " (alt)"} - ${holder.profession} ${holder.skillLevel} (${holder.member})`);
    await interaction.reply({
      content: holders.length ? fit(lines, `Characters with **${query}**:`) : `Nobody has ${query} recorded yet.`,
      ephemeral: true
    });
    return;
  }
  if (subcommand === "coverage") {
    const coverage = await professionCoverage(prisma, context.guildId);
    const lines = coverage.map((row) =>
      `**${row.profession}**: ${row.characters} character(s), top ${row.topSkill} (${row.topCharacter})`);
    await interaction.reply({
      content: coverage.length ? fit(lines, "Guild profession coverage:") : "No professions recorded yet.",
      ephemeral: true
    });
    return;
  }

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
