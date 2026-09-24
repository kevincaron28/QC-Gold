import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { guildService, requireGuildContext } from "./context.js";

export const characterCommand = new SlashCommandBuilder()
  .setName("character")
  .setDescription("Manage your WoW Forever characters.")
  .addSubcommand((subcommand) => subcommand
    .setName("add")
    .setDescription("Link a character to your profile.")
    .addStringOption((option) => option.setName("name").setDescription("Character name").setRequired(true))
    .addStringOption((option) => option.setName("realm").setDescription("Realm name").setRequired(true))
    .addStringOption((option) => option.setName("class").setDescription("Class").setRequired(true))
    .addBooleanOption((option) => option.setName("main").setDescription("Set as your main character").setRequired(true))
    .addStringOption((option) => option.setName("spec").setDescription("Specialization"))
    .addIntegerOption((option) => option.setName("level").setDescription("Character level").setMinValue(1).setMaxValue(100)))
  .addSubcommand((subcommand) => subcommand
    .setName("list")
    .setDescription("List your linked characters."));

export async function executeCharacter(interaction: ChatInputCommandInteraction): Promise<void> {
  const context = await requireGuildContext(interaction);
  if (!context) return;
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === "list") {
    const characters = await guildService.listCharacters(context.memberId);
    await interaction.reply({
      content: characters.length === 0
        ? "You have no linked characters."
        : characters.map((character) => `${character.isMain ? "⭐" : "•"} ${character.name} — ${character.className}${character.spec ? ` (${character.spec})` : ""}`).join("\n"),
      ephemeral: true
    });
    return;
  }

  const characterInput = {
    memberId: context.memberId,
    name: interaction.options.getString("name", true),
    realm: interaction.options.getString("realm", true),
    className: interaction.options.getString("class", true),
    isMain: interaction.options.getBoolean("main", true)
  };
  const spec = interaction.options.getString("spec");
  const level = interaction.options.getInteger("level");
  const character = await guildService.addCharacter({
    ...characterInput,
    ...(spec === null ? {} : { spec }),
    ...(level === null ? {} : { level })
  });
  await interaction.reply({ content: `Linked ${character.name} as ${character.isMain ? "your main character" : "an alt"}.`, ephemeral: true });
}
