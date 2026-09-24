import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { createAddonImportService } from "../services/addon-import.js";
import { createAuditService } from "../services/audit.js";
import { prisma } from "../database.js";
import { hasPermission } from "../permissions.js";
import { requireGuildContext } from "./context.js";

const importService = createAddonImportService(prisma);
const auditService = createAuditService(prisma);

export const importApplyCommand = new SlashCommandBuilder()
  .setName("import-apply")
  .setDescription("Apply a reviewed addon import to the DKP ledger.")
  .addStringOption((option) => option.setName("id").setDescription("Import ID").setRequired(true));

export async function executeImportApply(interaction: ChatInputCommandInteraction): Promise<void> {
  const context = await requireGuildContext(interaction);
  if (!context) return;
  if (!interaction.member || !hasPermission(interaction.member as Parameters<typeof hasPermission>[0], "officer")) {
    await interaction.reply({ content: "Only officers can apply addon imports.", ephemeral: true });
    return;
  }
  const importId = interaction.options.getString("id", true);
  const result = await importService.apply(context.guildId, importId, interaction.user.id);
  await auditService.record({
    guildId: context.guildId,
    actorId: interaction.user.id,
    action: "IMPORT_APPLIED",
    entityId: importId,
    metadata: {
      transactionCount: result.transactions.length,
      epgpTransactionCount: result.epgpTransactions.length,
      readinessSnapshotCount: result.readinessSnapshots.length,
      attunementCount: result.attunements.length
    }
  });
  await interaction.reply({
    content: `Applied import \`${importId}\`: ${result.transactions.length} DKP transaction(s), `
      + `${result.epgpTransactions.length} EPGP transaction(s), ${result.readinessSnapshots.length} `
      + `readiness snapshot(s), and ${result.attunements.length} attunement update(s) recorded.`,
    ephemeral: true
  });
}
