import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { RaidAttendanceStatus } from "@prisma/client";
import { prisma } from "../database.js";
import { createRaidService } from "../services/raid.js";
import { hasPermission } from "../permissions.js";
import { guildService, requireGuildContext } from "./context.js";

const raidService = createRaidService(prisma);

export const raidCommand = new SlashCommandBuilder()
  .setName("raid")
  .setDescription("Manage guild raids and attendance.")
  .addSubcommand((sub) => sub.setName("create").setDescription("Create a raid.")
    .addStringOption((o) => o.setName("title").setDescription("Raid title").setMinLength(3).setRequired(true))
    .addStringOption((o) => o.setName("time").setDescription("Start time in ISO-8601 format").setRequired(true))
    .addStringOption((o) => o.setName("description").setDescription("Optional description"))
    .addStringOption((o) => o.setName("bosses").setDescription("Comma-separated boss names")))
  .addSubcommand((sub) => sub.setName("edit").setDescription("Edit a planned raid.")
    .addStringOption((o) => o.setName("raid").setDescription("Raid ID").setRequired(true))
    .addStringOption((o) => o.setName("title").setDescription("New title"))
    .addStringOption((o) => o.setName("time").setDescription("New ISO-8601 start time"))
    .addStringOption((o) => o.setName("description").setDescription("New description")))
  .addSubcommand((sub) => sub.setName("cancel").setDescription("Cancel a raid.")
    .addStringOption((o) => o.setName("raid").setDescription("Raid ID").setRequired(true)))
  .addSubcommand((sub) => sub.setName("signup").setDescription("Sign up for a raid.")
    .addStringOption((o) => o.setName("raid").setDescription("Raid ID").setRequired(true)))
  .addSubcommand((sub) => sub.setName("cancel-signup").setDescription("Cancel your raid signup.")
    .addStringOption((o) => o.setName("raid").setDescription("Raid ID").setRequired(true)))
  .addSubcommand((sub) => sub.setName("status").setDescription("View raid status.")
    .addStringOption((o) => o.setName("raid").setDescription("Raid ID").setRequired(true)))
  .addSubcommand((sub) => sub.setName("roster").setDescription("View the raid roster.")
    .addStringOption((o) => o.setName("raid").setDescription("Raid ID").setRequired(true)))
  .addSubcommand((sub) => sub.setName("start").setDescription("Start a raid.")
    .addStringOption((o) => o.setName("raid").setDescription("Raid ID").setRequired(true)))
  .addSubcommand((sub) => sub.setName("end").setDescription("End a raid.")
    .addStringOption((o) => o.setName("raid").setDescription("Raid ID").setRequired(true)))
  .addSubcommand((sub) => sub.setName("attendance").setDescription("Record a member's raid attendance.")
    .addStringOption((o) => o.setName("raid").setDescription("Raid ID").setRequired(true))
    .addUserOption((o) => o.setName("player").setDescription("Member to record").setRequired(true))
    .addStringOption((o) => o.setName("status").setDescription("Attendance status").setRequired(true)
      .addChoices(
        { name: "Present", value: "PRESENT" },
        { name: "Late", value: "LATE" },
        { name: "Absent", value: "ABSENT" }
      ))
    .addStringOption((o) => o.setName("notes").setDescription("Optional notes")));

function requireRaidLeader(interaction: ChatInputCommandInteraction): void {
  if (!interaction.member || !hasPermission(interaction.member as Parameters<typeof hasPermission>[0], "raidLeader")) {
    throw new Error("Only Raid Leaders, Guild Masters, or Administrators can manage raids.");
  }
}

function parseRaidTime(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Raid time must be a valid ISO-8601 date.");
  return date;
}

export async function executeRaid(interaction: ChatInputCommandInteraction): Promise<void> {
  const context = await requireGuildContext(interaction);
  if (!context) return;
  const subcommand = interaction.options.getSubcommand();
  const management = ["create", "edit", "cancel", "start", "end", "attendance"].includes(subcommand);
  if (management) requireRaidLeader(interaction);

  if (subcommand === "create") {
    const description = interaction.options.getString("description");
    const bosses = interaction.options.getString("bosses");
    const raid = await raidService.create({
      guildId: context.guildId,
      title: interaction.options.getString("title", true),
      scheduledAt: parseRaidTime(interaction.options.getString("time", true)),
      createdBy: interaction.user.id,
      ...(description === null ? {} : { description }),
      ...(bosses === null ? {} : { bosses: bosses.split(",") })
    });
    await interaction.reply({ content: `Created raid **${raid.title}** with ID \`${raid.id}\`.`, ephemeral: true });
    return;
  }

  const raidId = interaction.options.getString("raid", true);
  if (subcommand === "signup" || subcommand === "cancel-signup") {
    if (subcommand === "signup") {
      await raidService.signup(raidId, context.guildId, context.memberId);
    } else {
      await raidService.cancelSignup(raidId, context.guildId, context.memberId);
    }
    await interaction.reply({ content: subcommand === "signup" ? "You are signed up for the raid." : "Your raid signup was cancelled.", ephemeral: true });
    return;
  }
  if (subcommand === "status") {
    const raid = await raidService.getStatus(raidId, context.guildId);
    const bosses = raid.bosses.length ? raid.bosses.map((boss) => `${boss.status === "KILLED" ? "✅" : "⬜"} ${boss.name}`).join("\n") : "No bosses recorded.";
    await interaction.reply({ content: `**${raid.title}** — ${raid.status}\nStart: <t:${Math.floor(raid.scheduledAt.getTime() / 1000)}:F>\nSignups: ${raid._count.signups}\nAttendance records: ${raid._count.attendance}\n${bosses}`, ephemeral: true });
    return;
  }
  if (subcommand === "roster") {
    const roster = await raidService.roster(raidId, context.guildId);
    await interaction.reply({ content: roster.length ? roster.map((signup) => `• ${signup.member.displayName} (<@${signup.member.discordUserId}>)`).join("\n") : "No members are signed up.", ephemeral: true });
    return;
  }
  if (subcommand === "edit") {
    const title = interaction.options.getString("title");
    const time = interaction.options.getString("time");
    const description = interaction.options.getString("description");
    const raid = await raidService.edit(raidId, context.guildId, {
      ...(title === null ? {} : { title }),
      ...(time === null ? {} : { scheduledAt: parseRaidTime(time) }),
      ...(description === null ? {} : { description })
    });
    await interaction.reply({ content: `Updated raid **${raid.title}**.`, ephemeral: true });
    return;
  }
  if (subcommand === "cancel") {
    const raid = await raidService.cancel(raidId, context.guildId);
    await interaction.reply({ content: `Cancelled raid **${raid.title}**.`, ephemeral: true });
    return;
  }
  if (subcommand === "start" || subcommand === "end") {
    const raid = subcommand === "start"
      ? await raidService.start(raidId, context.guildId)
      : await raidService.end(raidId, context.guildId);
    await interaction.reply({ content: `${subcommand === "start" ? "Started" : "Ended"} raid **${raid.title}**.`, ephemeral: true });
    return;
  }
  const player = interaction.options.getUser("player", true);
  const target = await guildService.ensureMember(context.guildId, player.id, player.username);
  const attendance = await raidService.recordAttendance({
    raidId,
    guildId: context.guildId,
    memberId: target.id,
    status: interaction.options.getString("status", true) as RaidAttendanceStatus,
    recordedBy: interaction.user.id,
    ...(interaction.options.getString("notes") === null ? {} : { notes: interaction.options.getString("notes", true) })
  });
  await interaction.reply({ content: `Recorded **${attendance.status}** attendance for ${player.username}.`, ephemeral: true });
}
