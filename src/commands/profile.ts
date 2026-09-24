import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { createDkpService } from "../services/dkp.js";
import { prisma } from "../database.js";
import { guildService, requireGuildContext } from "./context.js";

const dkpService = createDkpService(prisma);

export const profileCommand = new SlashCommandBuilder()
  .setName("profile")
  .setDescription("View your Quebec Gold member profile.");

export async function executeProfile(interaction: ChatInputCommandInteraction): Promise<void> {
  const context = await requireGuildContext(interaction);
  if (!context) return;
  const [member, characters, dkp] = await Promise.all([
    prisma.member.findUnique({ where: { id: context.memberId } }),
    guildService.listCharacters(context.memberId),
    dkpService.getBalance(context.memberId)
  ]);
  if (!member) throw new Error("Your guild profile could not be found.");

  const characterLines = characters.length === 0
    ? ["No characters linked yet."]
    : characters.map((character) => {
      const professions = character.professions
        .map((skill) => `${skill.profession} ${skill.skillLevel}`)
        .join(", ");
      return `${character.isMain ? "**Main**" : "Alt"}: ${character.name} (${character.className}${character.spec ? `, ${character.spec}` : ""})${professions ? ` — ${professions}` : ""}`;
    });
  await interaction.reply({
    embeds: [new EmbedBuilder()
      .setTitle(`⚜️ ${member.displayName}`)
      .setDescription(characterLines.join("\n"))
      .addFields({ name: "DKP", value: `${dkp}`, inline: true }, { name: "Status", value: member.status, inline: true })]
  });
}
