import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction, type Guild as DiscordGuild } from "discord.js";
import { RaidAttendanceStatus, RaidBossStatus, RaidRole } from "@prisma/client";
import { prisma } from "../database.js";
import { notifications, notify } from "../services/notify.js";
import { showEpProposal } from "./ep-award.js";
import { raidReportEmbed } from "./raid-report.js";
import { buildRaidReport } from "../services/raid-report.js";
import { bossProgress } from "../services/progress.js";
import { parseRaidTime } from "../services/raid-time.js";
import { createRaidService, type SignupAvailability } from "../services/raid.js";
import { hasPermission } from "../permissions.js";
import { guildService, requireGuildContext } from "./context.js";

const raidService = createRaidService(prisma);

const roleLabel: Record<RaidRole, string> = { TANK: "Tank", HEALER: "Healer", DPS: "DPS" };

export const raidCommand = new SlashCommandBuilder()
  .setName("raid")
  .setDescription("Manage guild raids and attendance.")
  .addSubcommand((sub) => sub.setName("create").setDescription("Create a raid.")
    .addStringOption((o) => o.setName("title").setDescription("Raid title").setMinLength(3).setRequired(true))
    .addStringOption((o) => o.setName("time").setDescription("When, e.g. friday 8pm, tonight 20:00, 2026-10-03 20:00").setRequired(true))
    .addStringOption((o) => o.setName("description").setDescription("Optional description"))
    .addStringOption((o) => o.setName("bosses").setDescription("Comma-separated boss names"))
    .addIntegerOption((o) => o.setName("tanks").setDescription("Tank slot cap").setMinValue(0))
    .addIntegerOption((o) => o.setName("healers").setDescription("Healer slot cap").setMinValue(0))
    .addIntegerOption((o) => o.setName("dps").setDescription("DPS slot cap").setMinValue(0)))
  .addSubcommand((sub) => sub.setName("progress").setDescription("Guild boss progression: first kills, kill counts, latest kill."))
  .addSubcommand((sub) => sub.setName("report").setDescription("Raid summary: duration, raiders, bosses, EP, loot. Posts it for everyone.")
    .addStringOption((o) => o.setName("raid").setDescription("Raid (start typing its name)").setAutocomplete(true).setRequired(true)))
  .addSubcommand((sub) => sub.setName("award-ep").setDescription("Propose EP for a raid from attendance and boss kills; approve with a button.")
    .addStringOption((o) => o.setName("raid").setDescription("Raid (start typing its name)").setAutocomplete(true).setRequired(true)))
  .addSubcommand((sub) => sub.setName("note").setDescription("Add an officer note to a raid (general, a boss, or what to improve).")
    .addStringOption((o) => o.setName("raid").setDescription("Raid (start typing its name)").setAutocomplete(true).setRequired(true))
    .addStringOption((o) => o.setName("text").setDescription("The note").setMaxLength(1000).setRequired(true))
    .addStringOption((o) => o.setName("boss").setDescription("Boss this note is about (optional)")))
  .addSubcommand((sub) => sub.setName("edit").setDescription("Edit a planned raid.")
    .addStringOption((o) => o.setName("raid").setDescription("Raid (start typing its name)").setAutocomplete(true).setRequired(true))
    .addStringOption((o) => o.setName("title").setDescription("New title"))
    .addStringOption((o) => o.setName("time").setDescription("New time, e.g. friday 8pm"))
    .addStringOption((o) => o.setName("description").setDescription("New description"))
    .addIntegerOption((o) => o.setName("tanks").setDescription("New tank slot cap").setMinValue(0))
    .addIntegerOption((o) => o.setName("healers").setDescription("New healer slot cap").setMinValue(0))
    .addIntegerOption((o) => o.setName("dps").setDescription("New DPS slot cap").setMinValue(0)))
  .addSubcommand((sub) => sub.setName("cancel").setDescription("Cancel a raid.")
    .addStringOption((o) => o.setName("raid").setDescription("Raid (start typing its name)").setAutocomplete(true).setRequired(true)))
  .addSubcommand((sub) => sub.setName("signup").setDescription("Sign up for a raid.")
    .addStringOption((o) => o.setName("raid").setDescription("Raid (start typing its name)").setAutocomplete(true).setRequired(true))
    .addStringOption((o) => o.setName("role").setDescription("Your role for this raid").setRequired(true)
      .addChoices(
        { name: "Tank", value: "TANK" },
        { name: "Healer", value: "HEALER" },
        { name: "DPS", value: "DPS" }
      ))
    .addStringOption((o) => o.setName("availability").setDescription("Available (default) or Maybe")
      .addChoices(
        { name: "Available", value: "AVAILABLE" },
        { name: "Maybe", value: "MAYBE" }
      )))
  .addSubcommand((sub) => sub.setName("cancel-signup").setDescription("Cancel your raid signup.")
    .addStringOption((o) => o.setName("raid").setDescription("Raid (start typing its name)").setAutocomplete(true).setRequired(true)))
  .addSubcommand((sub) => sub.setName("status").setDescription("View raid status.")
    .addStringOption((o) => o.setName("raid").setDescription("Raid (start typing its name)").setAutocomplete(true).setRequired(true)))
  .addSubcommand((sub) => sub.setName("roster").setDescription("View the raid roster.")
    .addStringOption((o) => o.setName("raid").setDescription("Raid (start typing its name)").setAutocomplete(true).setRequired(true)))
  .addSubcommand((sub) => sub.setName("start").setDescription("Start a raid.")
    .addStringOption((o) => o.setName("raid").setDescription("Raid (start typing its name)").setAutocomplete(true).setRequired(true)))
  .addSubcommand((sub) => sub.setName("end").setDescription("End a raid.")
    .addStringOption((o) => o.setName("raid").setDescription("Raid (start typing its name)").setAutocomplete(true).setRequired(true)))
  .addSubcommand((sub) => sub.setName("boss").setDescription("Mark a raid boss's kill status.")
    .addStringOption((o) => o.setName("raid").setDescription("Raid (start typing its name)").setAutocomplete(true).setRequired(true))
    .addStringOption((o) => o.setName("name").setDescription("Boss name").setRequired(true))
    .addStringOption((o) => o.setName("status").setDescription("Boss status").setRequired(true)
      .addChoices(
        { name: "Killed", value: "KILLED" },
        { name: "Pending", value: "PENDING" }
      )))
  .addSubcommand((sub) => sub.setName("attendance").setDescription("Record a member's raid attendance.")
    .addStringOption((o) => o.setName("raid").setDescription("Raid (start typing its name)").setAutocomplete(true).setRequired(true))
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

// "friday 8pm" etc. in the guild's timezone (see services/raid-time.ts).
async function readRaidTime(guildId: string, value: string): Promise<Date> {
  const settings = await guildService.getSettings(guildId);
  return parseRaidTime(value, settings?.timezone ?? "America/Toronto");
}

export async function syncSignupEmbed(discordGuild: DiscordGuild, guildId: string, raidId: string): Promise<void> {
  try {
    const raid = await raidService.getStatus(raidId, guildId);
    const everyone = await raidService.signups(raidId, guildId);
    const roster = everyone.filter((signup) => signup.status === "SIGNED_UP");
    const listOf = (status: string) => everyone.filter((signup) => signup.status === status)
      .map((signup) => `${signup.member.displayName} (${roleLabel[signup.role]})`).join(", ");
    const maybe = listOf("MAYBE");
    const waitlist = listOf("WAITLISTED");
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
      .setFooter({ text: `Raid ID: ${raid.id} — /raid signup raid:${raid.id} role:<Tank|Healer|DPS> [availability:Maybe]` });
    if (maybe) embed.addFields({ name: "Maybe", value: maybe.slice(0, 1000), inline: false });
    if (waitlist) embed.addFields({ name: "Waitlist (in order)", value: waitlist.slice(0, 1000), inline: false });
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

// DMs players moved off the waitlist. Best effort: closed DMs are ignored,
// and the updated signup embed shows the change anyway.
async function tellPromoted(
  interaction: ChatInputCommandInteraction,
  promoted: Array<{ raidId: string; role: RaidRole; member: { discordUserId: string } }>
): Promise<void> {
  for (const signup of promoted) {
    const raid = await prisma.raid.findUnique({ where: { id: signup.raidId }, select: { title: true, scheduledAt: true } });
    await interaction.client.users.send(signup.member.discordUserId,
      `A ${roleLabel[signup.role]} slot opened in **${raid?.title ?? "a raid"}**${raid ? ` (<t:${Math.floor(raid.scheduledAt.getTime() / 1000)}:F>)` : ""}. You're off the waitlist and signed up.`)
      .catch(() => undefined);
  }
}

export async function executeRaid(interaction: ChatInputCommandInteraction): Promise<void> {
  const context = await requireGuildContext(interaction);
  if (!context) return;
  const subcommand = interaction.options.getSubcommand();
  const management = ["create", "edit", "cancel", "start", "end", "attendance", "boss", "note", "award-ep"].includes(subcommand);
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
      scheduledAt: await readRaidTime(context.guildId, interaction.options.getString("time", true)),
      createdBy: interaction.user.id,
      ...(description === null ? {} : { description }),
      ...(bosses === null ? {} : { bosses: bosses.split(",") }),
      ...(tanks === null ? {} : { tankLimit: tanks }),
      ...(healers === null ? {} : { healerLimit: healers }),
      ...(dps === null ? {} : { dpsLimit: dps })
    });
    if (interaction.guild) await syncSignupEmbed(interaction.guild, context.guildId, raid.id);
    // Discord shows <t:...> in each reader's own timezone, so this doubles as a check.
    const when = Math.floor(raid.scheduledAt.getTime() / 1000);
    await interaction.reply({ content: `Created raid **${raid.title}** for <t:${when}:F> (<t:${when}:R>). If that time looks wrong, fix it with \`/raid edit\`.`, ephemeral: true });
    return;
  }

  if (subcommand === "progress") {
    const progress = await bossProgress(prisma, context.guildId);
    const day = (date: Date) => `<t:${Math.floor(date.getTime() / 1000)}:d>`;
    const lines = progress.map((boss) =>
      `**${boss.boss}** - first kill ${day(boss.firstKill)} (${boss.firstKillRaid}), ${boss.kills} kill${boss.kills === 1 ? "" : "s"}, latest ${day(boss.lastKill)}`);
    let text = "";
    for (const line of lines) {
      if (text.length + line.length > 3900) break;
      text += `${line}\n`;
    }
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle("⚜️ Quebec Gold progression")
      .setDescription(text || "No boss kills recorded yet. Mark kills with /raid boss.")
      .setFooter({ text: `${progress.length} boss(es) killed` })] });
    return;
  }

  const raidId = interaction.options.getString("raid", true);
  if (subcommand === "signup") {
    const role = interaction.options.getString("role", true) as RaidRole;
    const availability = (interaction.options.getString("availability") ?? "AVAILABLE") as SignupAvailability;
    const signup = await raidService.signup(raidId, context.guildId, context.memberId, role, availability);
    if (interaction.guild) await syncSignupEmbed(interaction.guild, context.guildId, raidId);
    const replies: Record<string, string> = {
      SIGNED_UP: `You are signed up as ${roleLabel[role]}.`,
      MAYBE: `You are marked as **maybe** (${roleLabel[role]}). Sign up again as Available to take a slot.`,
      WAITLISTED: `${roleLabel[role]} slots are full, so you're on the **waitlist**. You'll get a DM if a slot opens.`
    };
    await interaction.reply({ content: replies[signup.status] ?? "Signup recorded.", ephemeral: true });
    return;
  }
  if (subcommand === "cancel-signup") {
    const { promoted } = await raidService.cancelSignup(raidId, context.guildId, context.memberId);
    if (interaction.guild) await syncSignupEmbed(interaction.guild, context.guildId, raidId);
    await tellPromoted(interaction, promoted);
    await interaction.reply({ content: "Your raid signup was cancelled.", ephemeral: true });
    return;
  }
  if (subcommand === "report") {
    const report = await buildRaidReport(prisma, context.guildId, raidId);
    await interaction.reply({ embeds: [raidReportEmbed(report)], allowedMentions: { parse: [] } });
    return;
  }
  if (subcommand === "award-ep") {
    await showEpProposal(interaction, context.guildId, raidId, "Proposed EP (nothing is recorded until you approve):");
    return;
  }
  if (subcommand === "note") {
    const note = await raidService.addNote(raidId, context.guildId, interaction.options.getString("text", true), interaction.user.id,
      interaction.options.getString("boss") ?? undefined);
    await interaction.reply({ content: `Note added${note.bossName ? ` for **${note.bossName}**` : ""}. It shows in \`/raid status\`.`, ephemeral: true });
    return;
  }
  if (subcommand === "status") {
    const raid = await raidService.getStatus(raidId, context.guildId);
    const bosses = raid.bosses.length ? raid.bosses.map((boss) => `${boss.status === "KILLED" ? "✅" : "⬜"} ${boss.name}`).join("\n") : "No bosses recorded.";
    // Notes are officer-written; only raid leaders see them.
    const canSeeNotes = !!interaction.member && hasPermission(interaction.member as Parameters<typeof hasPermission>[0], "raidLeader");
    const notes = canSeeNotes && raid.notes.length
      ? `\n\n**Notes**\n${raid.notes.map((note) => `• ${note.bossName ? `[${note.bossName}] ` : ""}${note.body}`).join("\n")}`
      : "";
    const text = `**${raid.title}** — ${raid.status}\nStart: <t:${Math.floor(raid.scheduledAt.getTime() / 1000)}:F>\nSignups: ${raid._count.signups}\nAttendance records: ${raid._count.attendance}\n${bosses}${notes}`;
    await interaction.reply({ content: text.length > 1950 ? `${text.slice(0, 1940)}…` : text, ephemeral: true });
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
      ...(time === null ? {} : { scheduledAt: await readRaidTime(context.guildId, time) }),
      ...(description === null ? {} : { description }),
      ...(tanks === null ? {} : { tankLimit: tanks }),
      ...(healers === null ? {} : { healerLimit: healers }),
      ...(dps === null ? {} : { dpsLimit: dps })
    });
    if (interaction.guild) await syncSignupEmbed(interaction.guild, context.guildId, raidId);
    await tellPromoted(interaction, raid.promoted);
    await interaction.reply({
      content: `Updated raid **${raid.title}**.${raid.promoted.length ? ` Moved ${raid.promoted.length} player(s) off the waitlist.` : ""}`,
      ephemeral: true
    });
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
    if (subcommand === "end") {
      // Ending a raid shows the proposed EP with Approve / Cancel buttons.
      await showEpProposal(interaction, context.guildId, raidId, `Ended raid **${raid.title}**.`);
    } else {
      await interaction.reply({ content: `Started raid **${raid.title}**.`, ephemeral: true });
    }
    await notify(interaction.guild, subcommand === "start" ? notifications.raidStarted(raid.title) : notifications.raidEnded(raid.title));
    return;
  }
  if (subcommand === "boss") {
    const bossName = interaction.options.getString("name", true);
    const status = interaction.options.getString("status", true) as RaidBossStatus;
    const boss = await prisma.raidBoss.findFirst({ where: { raidId, name: { equals: bossName, mode: "insensitive" } } });
    if (!boss) throw new Error(`Boss "${bossName}" was not found for this raid.`);
    const updated = await raidService.setBossStatus(raidId, context.guildId, boss.id, status);
    await interaction.reply({ content: `Marked **${updated.name}** as ${updated.status}.`, ephemeral: true });
    if (updated.status === "KILLED") {
      const raid = await prisma.raid.findUnique({ where: { id: raidId }, select: { title: true } });
      await notify(interaction.guild, notifications.bossKilled(updated.name, raid?.title ?? "raid"));
    }
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
