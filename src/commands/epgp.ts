import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { prisma } from "../database.js";
import { createAuditService } from "../services/audit.js";
import { createEpgpService } from "../services/epgp.js";
import { hasPermission } from "../permissions.js";
import { guildService, requireGuildContext } from "./context.js";

const epgpService = createEpgpService(prisma);
const auditService = createAuditService(prisma);

export const epgpCommand = new SlashCommandBuilder()
  .setName("epgp")
  .setDescription("View and manage EPGP.")
  .addSubcommand((sub) => sub.setName("balance").setDescription("View your EP, GP, and PR."))
  .addSubcommand((sub) => sub.setName("history").setDescription("View your recent EPGP history."))
  .addSubcommand((sub) => sub.setName("leaderboard").setDescription("View the EPGP leaderboard."))
  .addSubcommand((sub) => sub.setName("award-ep").setDescription("Award EP to a member.")
    .addUserOption((o) => o.setName("player").setDescription("Guild member").setRequired(true))
    .addIntegerOption((o) => o.setName("amount").setDescription("EP amount").setMinValue(1).setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason").setMinLength(3).setRequired(true)))
  .addSubcommand((sub) => sub.setName("award-gp").setDescription("Award GP for an item.")
    .addUserOption((o) => o.setName("player").setDescription("Guild member").setRequired(true))
    .addIntegerOption((o) => o.setName("amount").setDescription("GP amount").setMinValue(1).setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason").setMinLength(3).setRequired(true)))
  .addSubcommand((sub) => sub.setName("decay").setDescription("Apply the configured EPGP decay to all active members."));

function officer(interaction: ChatInputCommandInteraction): boolean {
  return !!interaction.member && hasPermission(interaction.member as Parameters<typeof hasPermission>[0], "dkpOfficer");
}

export async function executeEpgp(interaction: ChatInputCommandInteraction): Promise<void> {
  const context = await requireGuildContext(interaction);
  if (!context) return;
  const subcommand = interaction.options.getSubcommand();
  const standing = await epgpService.getStanding(context.memberId);
  if (subcommand === "balance") {
    await interaction.reply({ content: `EP: **${standing.ep}** | GP: **${standing.gp}** | PR: **${standing.pr.toFixed(3)}**`, ephemeral: true });
    return;
  }
  if (subcommand === "history") {
    const history = await epgpService.getHistory(context.memberId);
    await interaction.reply({
      content: [`EP: **${standing.ep}** | GP: **${standing.gp}** | PR: **${standing.pr.toFixed(3)}**`,
        ...history.map((row) => `EP ${row.epAmount >= 0 ? "+" : ""}${row.epAmount}, GP ${row.gpAmount >= 0 ? "+" : ""}${row.gpAmount} — ${row.reason}`)].join("\n"),
      ephemeral: true
    });
    return;
  }
  if (subcommand === "leaderboard") {
    const members = await prisma.member.findMany({ where: { guildId: context.guildId, status: "ACTIVE" }, orderBy: { displayName: "asc" } });
    const rows = await Promise.all(members.map(async (member) => ({ member, standing: await epgpService.getStanding(member.id) })));
    rows.sort((a, b) => b.standing.pr - a.standing.pr);
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle("⚜️ Quebec Gold EPGP").setDescription(
      rows.length ? rows.map((row, i) => `${i + 1}. ${row.member.displayName} — EP ${row.standing.ep} | GP ${row.standing.gp} | PR ${row.standing.pr.toFixed(3)}`).join("\n") : "No EPGP recorded."
    )] });
    return;
  }
  if (!officer(interaction)) {
    await interaction.reply({ content: "Only EPGP officers, Officers, Guild Masters, or administrators can change EPGP.", ephemeral: true });
    return;
  }
  if (subcommand === "decay") {
    const settings = await guildService.getSettings(context.guildId);
    if (!settings) throw new Error("Guild settings have not been initialized.");
    const transactions = await epgpService.applyDecay(context.guildId, settings.epgpDecayPercent, interaction.user.id);
    await auditService.record({
      guildId: context.guildId,
      actorId: interaction.user.id,
      action: "EPGP_TRANSACTION_CREATED",
      metadata: { type: "DECAY", memberCount: transactions.length, percent: settings.epgpDecayPercent }
    });
    await interaction.reply({
      content: `Applied ${(settings.epgpDecayPercent * 100).toFixed(0)}% EPGP decay to ${transactions.length} member(s).`,
      ephemeral: true
    });
    return;
  }
  const target = interaction.options.getUser("player", true);
  const targetMember = await guildService.ensureMember(context.guildId, target.id, target.username);
  const amount = interaction.options.getInteger("amount", true);
  const reason = interaction.options.getString("reason", true);
  const transaction = subcommand === "award-ep"
    ? await epgpService.awardEP({ guildId: context.guildId, memberId: targetMember.id, amount, reason, createdBy: interaction.user.id })
    : await epgpService.awardItem({ guildId: context.guildId, memberId: targetMember.id, gp: amount, reason, createdBy: interaction.user.id });
  await auditService.record({ guildId: context.guildId, actorId: interaction.user.id, action: "EPGP_TRANSACTION_CREATED", entityId: transaction.id, metadata: { memberId: targetMember.id, epAmount: transaction.epAmount, gpAmount: transaction.gpAmount, reason } });
  await interaction.reply({ content: `Recorded ${transaction.epAmount ? `${transaction.epAmount} EP` : `${transaction.gpAmount} GP`} for ${target.username}.`, ephemeral: true });
}
