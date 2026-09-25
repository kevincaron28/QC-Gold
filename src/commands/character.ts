import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { prisma } from "../database.js";
import { importCharacter, parseCharacterString } from "../services/character-import.js";
import { applySelfExport, parseSelfExport } from "../services/self-export.js";
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
    .addIntegerOption((option) => option.setName("level").setDescription("Character level").setMinValue(1).setMaxValue(100))
    .addStringOption((option) => option.setName("race").setDescription("Race, e.g. Dwarf")))
  .addSubcommand((subcommand) => subcommand
    .setName("import")
    .setDescription("Link a character from the line the addon gives you (no typing details).")
    .addStringOption((option) => option.setName("code").setDescription("Paste the line from /qg character in game").setRequired(true))
    .addBooleanOption((option) => option.setName("main").setDescription("Set as your main (default: main only if you have none)")))
  .addSubcommand((subcommand) => subcommand
    .setName("sync")
    .setDescription("Send your character, gear check, consumables and attunements from the code /qg share shows.")
    .addStringOption((option) => option.setName("code").setDescription("Paste the whole code from /qg share in game").setRequired(true))
    .addBooleanOption((option) => option.setName("main").setDescription("Set as your main (default: main only if you have none)")))
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
        : characters.map((character) => `${character.isMain ? "⭐" : "•"} ${character.name} — ${character.race ? `${character.race} ` : ""}${character.className}${character.spec ? ` (${character.spec})` : ""}${character.lastSeenAt ? ` · last seen <t:${Math.floor(character.lastSeenAt.getTime() / 1000)}:R>` : ""}`).join("\n"),
      ephemeral: true
    });
    return;
  }

  if (subcommand === "sync") {
    const data = parseSelfExport(interaction.options.getString("code", true));
    const outcome = await applySelfExport(prisma, context.memberId, data, interaction.options.getBoolean("main") ?? undefined);
    const problems = data.findings.filter((finding) => finding.severity !== "INFO").length;
    await interaction.reply({
      content: `${outcome.action === "created" ? "Linked" : "Updated"} **${outcome.name}**${outcome.isMain ? " (your main)" : ""}.`
        + (outcome.status ? ` Gear check: **${outcome.status}**${problems ? ` (${problems} issue${problems === 1 ? "" : "s"})` : ""}.` : " No gear check in that code (run /qg inspect first).")
        + (data.consumables.length ? ` Consumables: ${data.consumables.map((row) => row.name).join(", ")}.` : "")
        + (outcome.attunements ? ` ${outcome.attunements} attunement${outcome.attunements === 1 ? "" : "s"} recorded.` : ""),
      ephemeral: true
    });
    return;
  }

  if (subcommand === "import") {
    const parsed = parseCharacterString(interaction.options.getString("code", true));
    const outcome = await importCharacter(prisma, context.memberId, parsed, interaction.options.getBoolean("main") ?? undefined);
    const details = [parsed.race, parsed.className, parsed.spec ? `(${parsed.spec})` : "", parsed.level ? `level ${parsed.level}` : ""].filter(Boolean).join(" ");
    await interaction.reply({
      content: `${outcome.action === "created" ? "Linked" : "Updated"} **${outcome.name}** (${parsed.realm}) as ${outcome.isMain ? "your main character" : "an alt"}: ${details}.`
        + (parsed.professions.length ? `\nProfessions: ${parsed.professions.map((p) => `${p.name} ${p.skillLevel}`).join(", ")}.` : ""),
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
  const race = interaction.options.getString("race");
  const character = await guildService.addCharacter({
    ...characterInput,
    ...(spec === null ? {} : { spec }),
    ...(level === null ? {} : { level }),
    ...(race === null ? {} : { race })
  });
  await interaction.reply({ content: `Linked ${character.name} as ${character.isMain ? "your main character" : "an alt"}.`, ephemeral: true });
}
