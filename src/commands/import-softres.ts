import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { createSoftresImportService, parseSoftresCsv, softresReport } from "../services/softres-import.js";
import { prisma } from "../database.js";
import { hasPermission } from "../permissions.js";
import { requireGuildContext } from "./context.js";

const softresService = createSoftresImportService(prisma);
const MAX_BYTES = 1_000_000;

export const importSoftresCommand = new SlashCommandBuilder()
  .setName("import-softres")
  .setDescription("Add a SoftRes.it reserves export to the players' wishlists (officers).")
  .addAttachmentOption((option) => option.setName("file").setDescription("The reserves CSV from the SoftRes raid page").setRequired(true))
  .addIntegerOption((option) => option.setName("priority").setDescription("Wishlist priority for reserves: 1 = high (default), 2 = medium, 3 = low").setMinValue(1).setMaxValue(3));

export async function executeImportSoftres(interaction: ChatInputCommandInteraction): Promise<void> {
  const context = await requireGuildContext(interaction);
  if (!context) return;
  if (!interaction.member || !hasPermission(interaction.member as Parameters<typeof hasPermission>[0], "officer")) {
    await interaction.reply({ content: "Only officers can import SoftRes reserves.", ephemeral: true });
    return;
  }
  const attachment = interaction.options.getAttachment("file", true);
  if (!attachment.name.toLowerCase().endsWith(".csv")) throw new Error("The SoftRes export must be a .csv file.");
  if (attachment.size > MAX_BYTES) throw new Error("That file is too big for a SoftRes export.");
  await interaction.deferReply({ ephemeral: true });
  const response = await fetch(attachment.url);
  if (!response.ok) throw new Error(`Could not download the file (${response.status}).`);
  const parsed = parseSoftresCsv(await response.text());
  if (parsed.rows.length === 0) throw new Error("That file has no reserves in it (only the header row). Export it after the raiders have reserved.");
  const summary = await softresService.apply(context.guildId, parsed, interaction.options.getInteger("priority") ?? 1);
  await interaction.editReply({ content: softresReport(summary).slice(0, 1900) });
}
