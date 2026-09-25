import { ChannelType, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { permissionRoles, hasPermission } from "../permissions.js";
import { guildService, requireGuildContext } from "./context.js";

export const configCommand = new SlashCommandBuilder()
  .setName("config")
  .setDescription("View or update Quebec Gold guild settings.")
  .addSubcommand((subcommand) => subcommand
    .setName("view")
    .setDescription("View current guild settings."))
  .addSubcommand((subcommand) => subcommand
    .setName("set")
    .setDescription("Update one guild setting.")
    .addStringOption((option) => option
      .setName("setting")
      .setDescription("Setting to update")
      .setRequired(true)
      .addChoices(
        { name: "Attendance DKP", value: "attendanceDkp" },
        { name: "Late attendance DKP", value: "lateAttendanceDkp" },
        { name: "Boss kill DKP", value: "bossKillDkp" },
        { name: "Minimum bid", value: "minimumBid" },
        { name: "Bid increment", value: "bidIncrement" },
        { name: "Auction duration (seconds)", value: "auctionDurationSec" },
        { name: "EPGP decay percent (0-100)", value: "epgpDecayPercent" },
        { name: "EPGP base GP (PR = EP / (GP + base))", value: "baseGp" },
        { name: "Raid reminder minutes before start (0 = off)", value: "raidReminderMinutes" },
        { name: "EP bonus for a full clear", value: "epCompletionBonus" }
      ))
    .addIntegerOption((option) => option.setName("value").setDescription("New non-negative value").setMinValue(0).setRequired(true)))
  .addSubcommand((sub) => sub.setName("welcome").setDescription("Configure the welcome message for new members.")
    .addChannelOption((o) => o.setName("channel").setDescription("Channel to post welcome messages in")
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .addStringOption((o) => o.setName("message").setDescription("Template. Variables: {mention} {username} {guild} {membercount}").setMaxLength(1000))
    .addBooleanOption((o) => o.setName("disable").setDescription("Turn off welcome messages")))
  .addSubcommand((sub) => sub.setName("farewell").setDescription("Configure the farewell message for departing members.")
    .addChannelOption((o) => o.setName("channel").setDescription("Channel to post farewell messages in")
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .addStringOption((o) => o.setName("message").setDescription("Template. Variables: {username} {guild} {membercount}").setMaxLength(1000))
    .addBooleanOption((o) => o.setName("disable").setDescription("Turn off farewell messages")))
  .addSubcommand((sub) => sub.setName("roles").setDescription("Configure automatic role assignment.")
    .addRoleOption((o) => o.setName("applicant").setDescription("Role auto-assigned when someone joins the Discord server"))
    .addRoleOption((o) => o.setName("member").setDescription("Role assigned automatically when an application is approved")))
  .addSubcommand((sub) => sub.setName("raid-channel").setDescription("Set the channel raid signup embeds are posted and updated in.")
    .addChannelOption((o) => o.setName("channel").setDescription("Raid signup channel")
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .addBooleanOption((o) => o.setName("disable").setDescription("Stop posting raid signup embeds")))
  .addSubcommand((sub) => sub.setName("log-channel").setDescription("Set the channel that receives member join/leave and moderation logs.")
    .addChannelOption((o) => o.setName("channel").setDescription("Log channel")
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .addBooleanOption((o) => o.setName("disable").setDescription("Stop logging")))
  .addSubcommand((sub) => sub.setName("weekly-report").setDescription("Post a weekly guild activity report in the notify channel.")
    .addBooleanOption((o) => o.setName("enabled").setDescription("Turn the weekly report on or off").setRequired(true)))
  .addSubcommand((sub) => sub.setName("notify-channel").setDescription("Channel for raid started/ended, boss kills, loot awards, and EPGP changes.")
    .addChannelOption((o) => o.setName("channel").setDescription("Announcement channel")
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .addBooleanOption((o) => o.setName("disable").setDescription("Stop announcements")))
  .addSubcommand((sub) => sub.setName("merit").setDescription("Rank /epgp leaderboard by PR x 30-day attendance instead of raw PR.")
    .addBooleanOption((o) => o.setName("enabled").setDescription("Use merit ranking").setRequired(true)))
  .addSubcommand((sub) => sub.setName("recruitment").setDescription("Schedule a recurring recruitment post.")
    .addChannelOption((o) => o.setName("channel").setDescription("Channel to post in")
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .addStringOption((o) => o.setName("message").setDescription("What to post").setMaxLength(1500))
    .addIntegerOption((o) => o.setName("interval_hours").setDescription("Hours between posts (1-720)").setMinValue(1).setMaxValue(720))
    .addBooleanOption((o) => o.setName("disable").setDescription("Stop recruitment posts")));

export async function executeConfig(interaction: ChatInputCommandInteraction): Promise<void> {
  const context = await requireGuildContext(interaction);
  if (!context) return;
  const subcommand = interaction.options.getSubcommand();
  const settings = await guildService.getSettings(context.guildId);
  if (!settings) throw new Error("Guild settings have not been initialized.");
  if (subcommand === "view") {
    await interaction.reply({
      content: [
        `Attendance: ${settings.attendanceDkp} DKP`,
        `Late attendance: ${settings.lateAttendanceDkp} DKP`,
        `Boss kill: ${settings.bossKillDkp} DKP`,
        `Minimum bid: ${settings.minimumBid} DKP`,
        `Bid increment: ${settings.bidIncrement} DKP`,
        `Auction duration: ${settings.auctionDurationSec}s`,
        `EPGP decay: ${(settings.epgpDecayPercent * 100).toFixed(0)}% (run \`/epgp decay\` to apply)`,
        `EPGP base GP: ${settings.baseGp} (PR = EP / (GP + base))`,
        `Full-clear EP bonus: ${settings.epCompletionBonus}`,
        `Raid reminders: ${settings.raidReminderMinutes > 0 ? `${settings.raidReminderMinutes} min before start` : "off"}`,
        `Notifications: ${settings.notifyChannelId ? `<#${settings.notifyChannelId}>` : "disabled"}`,
        `Welcome messages: ${settings.welcomeChannelId ? `<#${settings.welcomeChannelId}>` : "disabled"}`,
        `Farewell messages: ${settings.farewellChannelId ? `<#${settings.farewellChannelId}>` : "disabled"}`,
        `Applicant role: ${settings.applicantRoleId ? `<@&${settings.applicantRoleId}>` : "not set"}`,
        `Member role: ${settings.memberRoleId ? `<@&${settings.memberRoleId}>` : "not set"}`,
        `Raid signup channel: ${settings.raidSignupChannelId ? `<#${settings.raidSignupChannelId}>` : "disabled"}`,
        `Log channel: ${settings.logChannelId ? `<#${settings.logChannelId}>` : "disabled"}`,
        `Merit ranking: ${settings.meritEnabled ? "on" : "off"}`,
        `Recruitment posts: ${settings.recruitmentChannelId && settings.recruitmentMessage && settings.recruitmentIntervalHours
          ? `<#${settings.recruitmentChannelId}> every ${settings.recruitmentIntervalHours}h` : "disabled"}`
      ].join("\n"),
      ephemeral: true
    });
    return;
  }

  if (!interaction.guild || !interaction.member || !hasPermission(interaction.member as Parameters<typeof hasPermission>[0], "officer")) {
    await interaction.reply({
      content: `Only members with the ${permissionRoles.officer} role can change settings.`,
      ephemeral: true
    });
    return;
  }

  if (subcommand === "welcome" || subcommand === "farewell") {
    const disable = interaction.options.getBoolean("disable");
    if (disable) {
      await guildService.updateSettings(context.guildId, subcommand === "welcome"
        ? { welcomeChannelId: null, welcomeMessageTemplate: null }
        : { farewellChannelId: null, farewellMessageTemplate: null });
      await interaction.reply({ content: `${subcommand === "welcome" ? "Welcome" : "Farewell"} messages disabled.`, ephemeral: true });
      return;
    }
    const channel = interaction.options.getChannel("channel");
    const message = interaction.options.getString("message");
    if (!channel) throw new Error("Provide a channel, or use disable:true to turn messages off.");
    await guildService.updateSettings(context.guildId, subcommand === "welcome"
      ? { welcomeChannelId: channel.id, ...(message === null ? {} : { welcomeMessageTemplate: message }) }
      : { farewellChannelId: channel.id, ...(message === null ? {} : { farewellMessageTemplate: message }) });
    await interaction.reply({ content: `${subcommand === "welcome" ? "Welcome" : "Farewell"} messages will post in <#${channel.id}>.`, ephemeral: true });
    return;
  }

  if (subcommand === "log-channel") {
    if (interaction.options.getBoolean("disable")) {
      await guildService.updateSettings(context.guildId, { logChannelId: null });
      await interaction.reply({ content: "Logging disabled.", ephemeral: true });
      return;
    }
    const channel = interaction.options.getChannel("channel");
    if (!channel) throw new Error("Provide a channel, or use disable:true to turn logging off.");
    await guildService.updateSettings(context.guildId, { logChannelId: channel.id });
    await interaction.reply({ content: `Logs will post in <#${channel.id}>.`, ephemeral: true });
    return;
  }

  if (subcommand === "weekly-report") {
    const enabled = interaction.options.getBoolean("enabled", true);
    await guildService.updateSettings(context.guildId, { weeklyReportEnabled: enabled });
    await interaction.reply({
      content: enabled
        ? `Weekly report on. It posts in ${settings.notifyChannelId ? `<#${settings.notifyChannelId}>` : "the notify channel (set one with `/config notify-channel` first)"} within the hour, then every 7 days.`
        : "Weekly report off.",
      ephemeral: true
    });
    return;
  }

  if (subcommand === "notify-channel") {
    if (interaction.options.getBoolean("disable")) {
      await guildService.updateSettings(context.guildId, { notifyChannelId: null });
      await interaction.reply({ content: "Announcements disabled.", ephemeral: true });
      return;
    }
    const channel = interaction.options.getChannel("channel");
    if (!channel) throw new Error("Provide a channel, or use disable:true to turn announcements off.");
    await guildService.updateSettings(context.guildId, { notifyChannelId: channel.id });
    await interaction.reply({ content: `Raid, boss, loot, and EPGP announcements will post in <#${channel.id}>.`, ephemeral: true });
    return;
  }

  if (subcommand === "merit") {
    const enabled = interaction.options.getBoolean("enabled", true);
    await guildService.updateSettings(context.guildId, { meritEnabled: enabled });
    await interaction.reply({ content: `Merit ranking ${enabled ? "enabled" : "disabled"}. This only changes how /epgp leaderboard is ordered; the EPGP ledger is never touched.`, ephemeral: true });
    return;
  }

  if (subcommand === "recruitment") {
    if (interaction.options.getBoolean("disable")) {
      await guildService.updateSettings(context.guildId, { recruitmentChannelId: null, recruitmentMessage: null, recruitmentIntervalHours: null, recruitmentLastPostedAt: null });
      await interaction.reply({ content: "Recruitment posts disabled.", ephemeral: true });
      return;
    }
    const channel = interaction.options.getChannel("channel");
    const message = interaction.options.getString("message");
    const hours = interaction.options.getInteger("interval_hours");
    if (!channel || !message || !hours) throw new Error("Provide channel, message, and interval_hours together (or disable:true).");
    await guildService.updateSettings(context.guildId, {
      recruitmentChannelId: channel.id,
      recruitmentMessage: message,
      recruitmentIntervalHours: hours,
      recruitmentLastPostedAt: null
    });
    await interaction.reply({ content: `Will post in <#${channel.id}> every ${hours}h while the bot is running (first post within ~10 minutes).`, ephemeral: true });
    return;
  }

  if (subcommand === "raid-channel") {
    const disable = interaction.options.getBoolean("disable");
    if (disable) {
      await guildService.updateSettings(context.guildId, { raidSignupChannelId: null });
      await interaction.reply({ content: "Raid signup embeds disabled.", ephemeral: true });
      return;
    }
    const channel = interaction.options.getChannel("channel");
    if (!channel) throw new Error("Provide a channel, or use disable:true to turn raid signup embeds off.");
    await guildService.updateSettings(context.guildId, { raidSignupChannelId: channel.id });
    await interaction.reply({ content: `Raid signup embeds will post in <#${channel.id}>.`, ephemeral: true });
    return;
  }

  if (subcommand === "roles") {
    const applicantRole = interaction.options.getRole("applicant");
    const memberRole = interaction.options.getRole("member");
    if (!applicantRole && !memberRole) throw new Error("Provide at least one role to update.");
    await guildService.updateSettings(context.guildId, {
      ...(applicantRole ? { applicantRoleId: applicantRole.id } : {}),
      ...(memberRole ? { memberRoleId: memberRole.id } : {})
    });
    await interaction.reply({
      content: [
        applicantRole ? `Applicant role set to <@&${applicantRole.id}>.` : null,
        memberRole ? `Member role set to <@&${memberRole.id}>.` : null
      ].filter(Boolean).join("\n"),
      ephemeral: true
    });
    return;
  }

  const setting = interaction.options.getString("setting", true) as keyof typeof settings;
  const value = interaction.options.getInteger("value", true);
  if (setting === "id" || setting === "guildId" || setting === "createdAt" || setting === "updatedAt") {
    throw new Error("That setting cannot be changed.");
  }
  if (setting === "epgpDecayPercent") {
    if (value > 100) throw new Error("EPGP decay percent must be between 0 and 100.");
    await guildService.updateSettings(context.guildId, { epgpDecayPercent: value / 100 });
    await interaction.reply({ content: `Updated EPGP decay to ${value}%.`, ephemeral: true });
    return;
  }
  await guildService.updateSettings(context.guildId, { [setting]: value });
  await interaction.reply({ content: `Updated ${setting} to ${value}.`, ephemeral: true });
}
