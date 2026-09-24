import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { DkpTransactionType } from "@prisma/client";
import { prisma } from "../database.js";
import { createAuditService } from "../services/audit.js";
import { createDkpService } from "../services/dkp.js";
import { hasPermission } from "../permissions.js";
import { guildService, requireGuildContext } from "./context.js";

const dkpService = createDkpService(prisma);
const auditService = createAuditService(prisma);

export const dkpCommand = new SlashCommandBuilder()
  .setName("dkp")
  .setDescription("View and manage legacy DKP (superseded by /epgp for new activity).")
  .addSubcommand((subcommand) => subcommand.setName("balance").setDescription("View your DKP balance."))
  .addSubcommand((subcommand) => subcommand.setName("history").setDescription("View your recent DKP history."))
  .addSubcommand((subcommand) => subcommand.setName("leaderboard").setDescription("View the DKP leaderboard."))
  .addSubcommand((subcommand) => subcommand
    .setName("add")
    .setDescription("Award DKP to a guild member.")
    .addUserOption((option) => option.setName("player").setDescription("Discord member").setRequired(true))
    .addIntegerOption((option) => option.setName("amount").setDescription("Positive DKP amount").setMinValue(1).setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Reason").setMinLength(3).setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName("remove")
    .setDescription("Deduct DKP from a guild member.")
    .addUserOption((option) => option.setName("player").setDescription("Discord member").setRequired(true))
    .addIntegerOption((option) => option.setName("amount").setDescription("Positive DKP amount").setMinValue(1).setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Reason").setMinLength(3).setRequired(true)));

export async function executeDkp(interaction: ChatInputCommandInteraction): Promise<void> {
  const context = await requireGuildContext(interaction);
  if (!context) return;
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === "balance" || subcommand === "history") {
    const balance = await dkpService.getBalance(context.memberId);
    if (subcommand === "balance") {
      await interaction.reply({ content: `Your current DKP balance is **${balance}**.`, ephemeral: true });
      return;
    }
    const history = await dkpService.getHistory(context.memberId);
    await interaction.reply({
      content: [`Current balance: **${balance}**`, ...history.map((transaction) =>
        `${transaction.amount > 0 ? "+" : ""}${transaction.amount} — ${transaction.reason}`
      )].join("\n") || "No DKP transactions recorded.",
      ephemeral: true
    });
    return;
  }
  if (subcommand === "leaderboard") {
    const rows = await dkpService.getLeaderboard(context.guildId);
    const description = rows.length
      ? rows.map((row, index) => `${index + 1}. ${row.member.displayName} — **${row.balance} DKP**`).join("\n")
      : "No active guild members have DKP yet.";
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle("⚜️ Quebec Gold DKP").setDescription(description)] });
    return;
  }

  if (!interaction.member || !hasPermission(interaction.member as Parameters<typeof hasPermission>[0], "dkpOfficer")) {
    await interaction.reply({ content: "Only DKP Officers, Officers, Guild Masters, or Administrators can change DKP.", ephemeral: true });
    return;
  }
  const target = interaction.options.getUser("player", true);
  const targetMember = await guildService.ensureMember(context.guildId, target.id, target.username);
  const amount = interaction.options.getInteger("amount", true);
  const reason = interaction.options.getString("reason", true);
  const transaction = await dkpService.createTransaction({
    guildId: context.guildId,
    memberId: targetMember.id,
    amount: subcommand === "remove" ? -amount : amount,
    type: subcommand === "remove" ? DkpTransactionType.DEDUCTION : DkpTransactionType.AWARD,
    reason,
    createdBy: interaction.user.id
  });
  await auditService.record({
    guildId: context.guildId,
    actorId: interaction.user.id,
    action: "DKP_TRANSACTION_CREATED",
    entityId: transaction.id,
    metadata: { memberId: targetMember.id, amount: transaction.amount, reason }
  });
  await interaction.reply({ content: `Recorded ${transaction.amount > 0 ? "+" : ""}${transaction.amount} DKP for ${target.username}.`, ephemeral: true });
}
