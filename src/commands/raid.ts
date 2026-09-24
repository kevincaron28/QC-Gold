import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction, type Guild as DiscordGuild } from "discord.js";
import { RaidAttendanceStatus, RaidBossStatus, RaidRole } from "@prisma/client";
import { prisma } from "../database.js";
import { createRaidService } from "../services/raid.js";
import { hasPermission } from "../permissions.js";
import { guildService, requireGuildContext } from "./context.js";

const raidService = createRaidService(prisma);

const roleLabel: Record<RaidRole, string> = { TANK: "Tank", HEALER: "Healer", DPS: "DPS" };

export const raidCommand = new SlashCommandBuilder()
  .setName("raid")
  .setDescription("Manage guild raids and attendance.")
  .addSubcommand((sub) => sub.setName("create").setDescription("Create a raid.")
    .addStringOption((o) => o.setName("title").setDescription("Raid title").setMinLength(3).setRequired(true))
    .addStringOption((o) => o.setName("time").setDescription("Start time in ISO-8601 format").setRequired(true))
    .addStringOption((o) => o.setName("description").setDescription("Optional description"))
    .addStringOption((o) => o.setName("bosses").setDescription("Comma-separated boss names"))
    .addIntegerOption((o) => o.setName("tanks").setDescription("Tank slot cap").setMinValue(0))
    .addIntegerOption((o) => o.setName("healers").setDescription("Healer slot cap").setMinValue(0))
    .addIntegerOption((o) => o.setName("dps").setDescription("DPS slot cap").setMinValue(0)))
  .addSubcommand((sub) => sub.setName("edit").setDescription("Edit a planned raid.")
    .addStringOption((o) => o.setName("raid").setDescription("Raid ID").setRequired(true))
    .addStringOption((o) => o.setName("title").setDescription("New title"))
    .addStringOption((o) => o.setName("time").setDescription("New ISO-8601 start time"))
    .addStringOption((o) => o.setName("description").setDescription("New description"))
    .addIntegerOption((o) => o.setName("tanks").setDescription("New tank slot cap").setMinValue(0))
    .addIntegerOption((o) => o.setName("healers").setDescription("New healer slot cap").setMinValue(0))
    .addIntegerOption((o) => o.setName("dps").setDescription("New DPS slot cap").setMinValue(0)))
  .addSubcommand((sub) => sub.setName("cancel").setDescription("Cancel a raid.")
    .addStringOption((o) => o.setName("raid").setDescription("Raid ID").setRequired(true)))
  .addSubcommand((sub) => sub.setName("signup").setDescription("Sign up for a raid.")
    .addStringOption((o) => o.setName("raid").setDescription("Raid ID").setRequired(true))
    .addStringOption((o) => o.setName("role").setDescription("Your role for this raid").setRequired(true)
      .addChoices(
        { name: "Tank", value: "TANK" },
        { name: "Healer", value: "HEALER" },
        { name: "DPS", value: "DPS" }
      )))
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
  .addSubcommand((sub) => sub.setName("boss").setDescription("Mark a raid boss's kill status.")
    .addStringOption((o) => o.setName("raid").setDescription("Raid ID").setRequired(true))
    .addStringOption((o) => o.setName("name").setDescription("Boss name").setRequired(true))
    .addStringOption((o) => o.setName("status").setDescription("Boss status").setRequired(true)
      .addChoices(
        { name: "Killed", value: "KILLED" },
        { name: "Pending", value: "PENDING" }
      )))
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
    throw new Error("Only Raid Leaders, Officers, Guild Masters, or Administrators can manage raids.");
  }
}

function parseRaidTime(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Raid time must be a valid ISO-8601 date.");
  return date;
}

async function syncSignupEmbed(discordGuild: DiscordGuild, guildId: string, raidId: string): Promise<void> {
  try {
    const raid = await raidService.getStatus(raidId, guildId);
    const roster = await raidService.roster(raidId, guildId);
    const caps: Record<RaidRole, number | null> = { TANK: raid.tankLimit, HEALER: raid.healerLimit, DPS: raid.dpsLimit };
    const roleLines = (["TANK", "HEALER", "DPS"] as const).map((role) => {
      const count = roster.filter((signup) => signup.role === role).length;
      const cap = caps[role];
      return `${roleLabel[role]}: ${count}${cap !== null ? `/${cap}` : ""}`;
    });

    const embed = new EmbedBuilder()
      .setTitle(`⚜️ ${raid.title}`)
      .addFields(
        { name: "Status", value: raid.status, inline: true },
        { name: "Start", value: `<t:${Math.floor(raid.scheduledAt.getTime() / 1000)}:F>`, inline: true },
        { name: "Total signed up", value: String(roster.length), inline: true },
        { name: "Roles", value: roleLines.join("\n"), inline: false }
      )
      .setFooter({ text: `Raid ID: ${raid.id} — /raid signup raid:${raid.id} role:<Tank|Healer|DPS>` });
    if (raid.description) embed.setDescription(raid.description);

    if (raid.signupChannelId && raid.signupMessageId) {
      const channel = await discordGuild.channels.fetch(raid.signupChannelId).catch(() => null);
      if (channel?.isTextBased()) {
        const message = await channel.messages.fetch(raid.signupMessageId).catch(() => null);
        if (message) {
          await message.edit({ embeds: [embed] });
          return;
        }
      }
    }

    const settings = await guildService.getSettings(guildId);
    if (!raid.signupChannelId && settings?.raidSignupChannelId) {
      const channel = await discordGuild.channels.fetch(settings.raidSignupChannelId).catch(() => null);
      if (channel?.isTextBased()) {
        const message = await channel.send({ embeds: [embed] });
        await raidService.setSignupMessage(raidId, guildId, channel.id, message.id);
      }
    }
  } catch (error) {
    console.error("Failed to sync raid signup embed", error);
  }
}

export async function executeRaid(interaction: ChatInputCommandInteraction): Promise<void> {
  const context = await requireGuildContext(interaction);
  if (!context) return;
  const subcommand = interaction.options.getSubcommand();
  const management = ["create", "edit", "cancel", "start", "end", "attendance", "boss"].includes(subcommand);
  if (management) requireRaidLeader(interaction);

  if (subcommand === "create") {
    const description = interaction.options.getString("description");
    const bosses = interaction.options.getString("bosses");
    const tanks = interaction.options.getInteger("tanks");
    const healers = interaction.options.getInteger("healers");
    const dps = interaction.options.getInteger("dps");
    const raid = await raidService.create({
      guildId: context.guildId,
      title: interaction.options.getString("title", true),
      scheduledAt: parseRaidTime(interaction.options.getString("time", true)),
      createdBy: interaction.user.id,
      ...(description === null ? {} : { description }),
      ...(bosses === null ? {} : { bosses: bosses.split(",") }),
      ...(tanks === null ? {} : { tankLimit: tanks }),
      ...(healers === null ? {} : { healerLimit: healers }),
      ...(dps === null ? {} : { dpsLimit: dps })
    });
    if (interaction.guild) await syncSignupEmbed(interaction.guild, context.guildId, raid.id);
    await interaction.reply({ content: `Created raid **${raid.title}** with ID \`${raid.id}\`.`, ephemeral: true });
    return;
  }

  const raidId = interaction.options.getString("raid", true);
  if (subcommand === "signup" || subcommand === "cancel-signup") {
    if (subcommand === "signup") {
      const role = interaction.options.getString("role", true) as RaidRole;
      await raidService.signup(raidId, context.guildId, context.memberId, role);
    } else {
      await raidService.cancelSignup(raidId, context.guildId, context.memberId);
    }
    if (interaction.guild) await syncSignupEmbed(interaction.guild, context.guildId, raidId);
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
    await interaction.reply({ content: roster.length ? roster.map((signup) => `• ${signup.member.displayName} (<@${signup.member.discordUserId}>) — ${roleLabel[signup.role]}`).join("\n") : "No members are signed up.", ephemeral: true });
    return;
  }
  if (subcommand === "edit") {
    const title = interaction.options.getString("title");
    const time = interaction.options.getString("time");
    const description = interaction.options.getString("description");
    const tanks = interaction.options.getInteger("tanks");
    const healers = interaction.options.getInteger("healers");
    const dps = interaction.options.getInteger("dps");
    const raid = await raidService.edit(raidId, context.guildId, {
      ...(title === null ? {} : { title }),
      ...(time === null ? {} : { scheduledAt: parseRaidTime(time) }),
      ...(description === null ? {} : { description }),
      ...(tanks === null ? {} : { tankLimit: tanks }),
      ...(healers === null ? {} : { healerLimit: healers }),
      ...(dps === null ? {} : { dpsLimit: dps })
    });
    if (interaction.guild) await syncSignupEmbed(interaction.guild, context.guildId, raidId);
    await interaction.reply({ content: `Updated raid **${raid.title}**.`, ephemeral: true });
    return;
  }
  if (subcommand === "cancel") {
    const raid = await raidService.cancel(raidId, context.guildId);
    if (interaction.guild) await syncSignupEmbed(interaction.guild, context.guildId, raidId);
    await interaction.reply({ content: `Cancelled raid **${raid.title}**.`, ephemeral: true });
    return;
  }
  if (subcommand === "start" || subcommand === "end") {
    const raid = subcommand === "start"
      ? await raidService.start(raidId, context.guildId)
      : await raidService.end(raidId, context.guildId);
    if (interaction.guild) await syncSignupEmbed(interaction.guild, context.guildId, raidId);
    await interaction.reply({ content: `${subcommand === "start" ? "Started" : "Ended"} raid **${raid.title}**.`, ephemeral: true });
    return;
  }
  if (subcommand === "boss") {
    const bossName = interaction.options.getString("name", true);
    const status = interaction.options.getString("status", true) as RaidBossStatus;
    const boss = await prisma.raidBoss.findFirst({ where: { raidId, name: { equals: bossName, mode: "insensitive" } } });
    if (!boss) throw new Error(`Boss "${bossName}" was not found for this raid.`);
    const updated = await raidService.setBossStatus(raidId, context.guildId, boss.id, status);
    await interaction.reply({ content: `Marked **${updated.name}** as ${updated.status}.`, ephemeral: true });
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
