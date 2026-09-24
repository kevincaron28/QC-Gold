import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { prisma } from "../database.js";
import { hasPermission } from "../permissions.js";
import { requireGuildContext } from "./context.js";

export const readinessCommand = new SlashCommandBuilder()
  .setName("readiness").setDescription("Review raid readiness.")
  .addSubcommand((sub) => sub.setName("me").setDescription("Show your latest readiness."))
  .addSubcommand((sub) => sub.setName("member").setDescription("Show a member's readiness.")
    .addUserOption((o) => o.setName("player").setDescription("Guild member").setRequired(true)))
  .addSubcommand((sub) => sub.setName("raid").setDescription("Show latest readiness for the guild."));

function canReview(interaction: ChatInputCommandInteraction): boolean {
  return !!interaction.member && (
    hasPermission(interaction.member as Parameters<typeof hasPermission>[0], "guildMaster") ||
    hasPermission(interaction.member as Parameters<typeof hasPermission>[0], "raidLeader") ||
    hasPermission(interaction.member as Parameters<typeof hasPermission>[0], "lootLeader") ||
    hasPermission(interaction.member as Parameters<typeof hasPermission>[0], "classLeader")
  );
}

type ReadinessSummary = {
  status: string;
  itemLevel: number | null;
  findings: Array<{ severity: string; message: string }>;
};

function format(snapshot: ReadinessSummary | null, name: string): string {
  if (!snapshot) return `${name}: UNKNOWN — no inspection has been uploaded.`;
  const findings = snapshot.findings.map((finding) => `${finding.severity}: ${finding.message}`).join("\n");
  return `${name}: **${snapshot.status}**${snapshot.itemLevel ? ` | item level ${snapshot.itemLevel}` : ""}${findings ? `\n${findings}` : ""}`;
}

export async function executeReadiness(interaction: ChatInputCommandInteraction): Promise<void> {
  const context = await requireGuildContext(interaction);
  if (!context) return;
  const subcommand = interaction.options.getSubcommand();
  if (subcommand !== "me" && !canReview(interaction)) {
    await interaction.reply({ content: "Only Guild Masters, Officers, Raid Leaders, Loot Leaders, and Class Leaders can review other members.", ephemeral: true });
    return;
  }
  if (subcommand === "me") {
    const snapshot = await prisma.inspectedCharacterSnapshot.findFirst({ where: { memberId: context.memberId }, orderBy: { inspectedAt: "desc" }, include: { findings: true, character: true } });
    await interaction.reply({ content: format(snapshot, snapshot?.character.name ?? interaction.user.username), ephemeral: true });
    return;
  }
  if (subcommand === "member") {
    const user = interaction.options.getUser("player", true);
    const member = await prisma.member.findUnique({ where: { guildId_discordUserId: { guildId: context.guildId, discordUserId: user.id } } });
    const snapshot = member ? await prisma.inspectedCharacterSnapshot.findFirst({ where: { memberId: member.id }, orderBy: { inspectedAt: "desc" }, include: { findings: true, character: true } }) : null;
    await interaction.reply({ content: format(snapshot, user.username), ephemeral: true });
    return;
  }
  const members = await prisma.member.findMany({ where: { guildId: context.guildId, status: "ACTIVE" }, orderBy: { displayName: "asc" } });
  const rows = await Promise.all(members.map(async (member) => {
    const snapshot = await prisma.inspectedCharacterSnapshot.findFirst({ where: { memberId: member.id }, orderBy: { inspectedAt: "desc" }, include: { findings: true, character: true } });
    return format(snapshot, member.displayName);
  }));
  await interaction.reply({ content: rows.join("\n\n") || "No guild members found." });
}
