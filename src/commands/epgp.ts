import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { prisma } from "../database.js";
import { createAuditService } from "../services/audit.js";
import { createEpgpService } from "../services/epgp.js";
import { createMeritService, meritScore } from "../services/merit.js";
import { notifications, notify } from "../services/notify.js";
import { hasPermission } from "../permissions.js";
import { guildService, requireGuildContext } from "./context.js";
import { BRAND } from "../brand.js";

const epgpService = createEpgpService(prisma);
const meritService = createMeritService(prisma);
const auditService = createAuditService(prisma);

export const epgpCommand = new SlashCommandBuilder()
  .setName("epgp")
  .setDescription("View and manage EPGP.")
  .addSubcommand((sub) => sub.setName("balance").setDescription("View your EP, GP, and PR."))
  .addSubcommand((sub) => sub.setName("history").setDescription("View recent EPGP history (officers can view anyone's).")
    .addUserOption((o) => o.setName("player").setDescription("Guild member (officers only; default you)")))
  .addSubcommand((sub) => sub.setName("leaderboard").setDescription("View the EPGP leaderboard."))
  .addSubcommand((sub) => sub.setName("award-ep").setDescription("Award EP to a member.")
    .addUserOption((o) => o.setName("player").setDescription("Guild member").setRequired(true))
    .addIntegerOption((o) => o.setName("amount").setDescription("EP amount").setMinValue(1).setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason").setMinLength(3).setRequired(true)))
  .addSubcommand((sub) => sub.setName("award-gp").setDescription("Award GP for an item.")
    .addUserOption((o) => o.setName("player").setDescription("Guild member").setRequired(true))
    .addIntegerOption((o) => o.setName("amount").setDescription("GP amount").setMinValue(1).setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason").setMinLength(3).setRequired(true)))
  .addSubcommand((sub) => sub.setName("decay").setDescription("Apply the configured EPGP decay to all active members."))
  .addSubcommand((sub) => sub.setName("reverse").setDescription("Undo a mistaken EPGP entry (adds an opposite entry; history is kept).")
    .addStringOption((o) => o.setName("entry").setDescription("Entry (start typing a name or reason)").setAutocomplete(true).setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Why it is being reversed").setMinLength(3).setRequired(true)));

function officer(interaction: ChatInputCommandInteraction): boolean {
  return !!interaction.member && hasPermission(interaction.member as Parameters<typeof hasPermission>[0], "dkpOfficer");
}

export async function executeEpgp(interaction: ChatInputCommandInteraction): Promise<void> {
  const context = await requireGuildContext(interaction);
  if (!context) return;
  const subcommand = interaction.options.getSubcommand();
  const settings = await guildService.getSettings(context.guildId);
  const baseGp = settings?.baseGp ?? 0;
  const standing = await epgpService.getStanding(context.memberId, baseGp);
  if (subcommand === "balance") {
    await interaction.reply({ content: `EP: **${standing.ep}** | GP: **${standing.gp}** | PR: **${standing.pr.toFixed(3)}**`, ephemeral: true });
    return;
  }
  if (subcommand === "history") {
    const other = interaction.options.getUser("player");
    let memberId = context.memberId;
    let shown = standing;
    if (other && other.id !== interaction.user.id) {
      if (!officer(interaction)) {
        await interaction.reply({ content: "Only EPGP officers can view someone else's history.", ephemeral: true });
        return;
      }
      memberId = (await guildService.ensureMember(context.guildId, other.id, other.username)).id;
      shown = await epgpService.getStanding(memberId, baseGp);
    }
    const history = await epgpService.getHistory(memberId);
    // Entry IDs are shown so officers can pass one to /epgp reverse.
    await interaction.reply({
      content: [`${other ? `**${other.username}** - ` : ""}EP: **${shown.ep}** | GP: **${shown.gp}** | PR: **${shown.pr.toFixed(3)}**`,
        ...history.map((row) => `EP ${row.epAmount >= 0 ? "+" : ""}${row.epAmount}, GP ${row.gpAmount >= 0 ? "+" : ""}${row.gpAmount} — ${row.reason} \`${row.id}\``)].join("\n"),
      ephemeral: true
    });
    return;
  }
  if (subcommand === "leaderboard") {
    const members = await prisma.member.findMany({ where: { guildId: context.guildId, status: "ACTIVE" }, orderBy: { displayName: "asc" } });
    const rows = await Promise.all(members.map(async (member) => ({ member, standing: await epgpService.getStanding(member.id, baseGp) })));
    const merit = settings?.meritEnabled === true;
    const rates = await meritService.getAttendanceRates(context.guildId);
    const scored = rows.map((row) => {
      const rate = rates.get(row.member.id) ?? 0;
      return { ...row, rate, score: merit ? meritScore(row.standing.pr, rate) : row.standing.pr };
    });
    scored.sort((a, b) => b.score - a.score);
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`${BRAND.emoji} ${BRAND.name} EPGP`).setDescription(
      scored.length
        ? scored.map((row, i) => `${i + 1}. ${row.member.displayName} - EP ${row.standing.ep} | GP ${row.standing.gp} | PR ${row.standing.pr.toFixed(3)} | Att ${Math.round(row.rate * 100)}%${merit ? ` | Merit ${row.score.toFixed(3)}` : ""}`).join("\n")
        : "No EPGP recorded."
    ).setFooter({ text: (merit ? "Ranked by merit = PR x attendance over the last 30 days. Ledger is unaffected." : "Att = attendance over the last 30 days (Present = 1, Late = 0.5).") + (baseGp > 0 ? ` PR = EP / (GP + ${baseGp} base GP).` : "") })] });
    return;
  }
  if (!officer(interaction)) {
    await interaction.reply({ content: "Only EPGP officers, Officers, Guild Masters, or administrators can change EPGP.", ephemeral: true });
    return;
  }
  if (subcommand === "decay") {
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
    await notify(interaction.guild, notifications.decayApplied(Math.round(settings.epgpDecayPercent * 100), transactions.length));
    return;
  }
  if (subcommand === "reverse") {
    const entryId = interaction.options.getString("entry", true).replace(/`/g, "").trim();
    const reason = interaction.options.getString("reason", true);
    const reversal = await epgpService.reverseTransaction(entryId, interaction.user.id, `Reversal: ${reason}`, context.guildId);
    await auditService.record({
      guildId: context.guildId,
      actorId: interaction.user.id,
      action: "EPGP_TRANSACTION_CREATED",
      entityId: reversal.id,
      metadata: { type: "REVERSAL", reversedId: entryId, epAmount: reversal.epAmount, gpAmount: reversal.gpAmount, reason }
    });
    await interaction.reply({
      content: `Reversed \`${entryId}\`: EP ${reversal.epAmount >= 0 ? "+" : ""}${reversal.epAmount}, GP ${reversal.gpAmount >= 0 ? "+" : ""}${reversal.gpAmount}. Both entries stay in the history.`,
      ephemeral: true
    });
    const reversedMember = await prisma.member.findUnique({ where: { id: reversal.memberId }, select: { displayName: true } });
    await notify(interaction.guild, notifications.epgpChanged(reversedMember?.displayName ?? "member", reversal.epAmount, reversal.gpAmount, `correction: ${reason}`), "loot");
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
  await notify(interaction.guild, notifications.epgpChanged(targetMember.displayName, transaction.epAmount, transaction.gpAmount, reason), "loot");
}
