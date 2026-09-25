import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Guild as DiscordGuild,
  type GuildMember,
  type MessageComponentInteraction,
  type OverwriteResolvable
} from "discord.js";
import type { GuildSettings } from "@prisma/client";
import { config } from "../config.js";
import { prisma } from "../database.js";
import { hasPermission, permissionRoles } from "../permissions.js";
import { formatChecks, setupChecks, setupComplete, type ChannelFact, type SetupFacts } from "../services/setup-status.js";
import { guildService, requireGuildContext } from "./context.js";

// Guided first-time setup. One private message that walks an admin through
// five steps with buttons and dropdowns only (no IDs, no typing):
//   1 roles  2 channels  3 welcome & auto-roles  4 EPGP & automation  5 summary
// Safe to re-run any time: it shows what's already set and changes only
// what you click. `/setup status:true` shows just the checklist.

export const setupCommand = new SlashCommandBuilder()
  .setName("setup")
  .setDescription("Guided setup for Quebec Gold (admins). Safe to run again any time.")
  .addBooleanOption((o) => o.setName("status").setDescription("Only show the setup checklist"));

const REQUIRED_ROLES: string[] = [permissionRoles.guildMaster, permissionRoles.officer, permissionRoles.raidLeader, permissionRoles.dkpOfficer];
const OPTIONAL_ROLES: string[] = [permissionRoles.lootLeader, permissionRoles.classLeader];
const RELEASES_URL = "https://github.com/kevincaron28/QC-Gold/releases/latest";

const RECOMMENDED_EPGP = {
  attendanceDkp: 10,
  lateAttendanceDkp: 5,
  bossKillDkp: 5,
  epCompletionBonus: 10,
  baseGp: 100,
  epgpDecayPercent: 0.1,
  minimumBid: 10,
  bidIncrement: 5
};

const STEP_TITLES = ["Welcome", "Step 1 of 4 — Permission roles", "Step 2 of 4 — Channels", "Step 3 of 4 — Welcome & auto-roles", "Step 4 of 4 — EPGP & automation", "All done"];

// ---------------------------------------------------------------------
// Facts about the server, for the checklist
// ---------------------------------------------------------------------

async function channelFact(guild: DiscordGuild, channelId: string | null | undefined): Promise<ChannelFact | null> {
  if (!channelId) return null;
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel) return { name: "deleted-channel", exists: false, botCanPost: false };
  const me = guild.members.me;
  const perms = me ? channel.permissionsFor(me) : null;
  return {
    name: channel.name,
    exists: true,
    botCanPost: !!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])
  };
}

function botCanAssign(guild: DiscordGuild, roleId: string): { name: string; botCanAssign: boolean } | null {
  const role = guild.roles.cache.get(roleId);
  if (!role) return null;
  const me = guild.members.me;
  const ok = !!me && me.permissions.has(PermissionFlagsBits.ManageRoles) && me.roles.highest.comparePositionTo(role) > 0;
  return { name: role.name, botCanAssign: ok };
}

async function gatherFacts(guild: DiscordGuild, guildId: string, settings: GuildSettings): Promise<SetupFacts> {
  await guild.roles.fetch();
  const autoRoles = [settings.applicantRoleId, settings.memberRoleId]
    .filter((id): id is string => !!id)
    .map((id) => botCanAssign(guild, id))
    .filter((role): role is { name: string; botCanAssign: boolean } => role !== null);
  return {
    existingRoleNames: guild.roles.cache.map((role) => role.name),
    requiredRoleNames: REQUIRED_ROLES,
    notifyChannel: await channelFact(guild, settings.notifyChannelId),
    raidChannel: await channelFact(guild, settings.raidSignupChannelId),
    logChannel: await channelFact(guild, settings.logChannelId),
    welcomeChannel: await channelFact(guild, settings.welcomeChannelId),
    autoRoles,
    epgpConfigured: settings.baseGp > 0,
    remindersOn: settings.raidReminderMinutes > 0,
    weeklyReportOn: settings.weeklyReportEnabled,
    companionTokenSet: !!config.COMPANION_UPLOAD_TOKEN,
    linkedCharacters: await prisma.character.count({ where: { member: { guildId, isTest: false } } })
  };
}

// ---------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------

const button = (id: string, label: string, style: ButtonStyle = ButtonStyle.Secondary, disabled = false) =>
  new ButtonBuilder().setCustomId(`setup:${id}`).setLabel(label).setStyle(style).setDisabled(disabled);

function navRow(step: number, extra: ButtonBuilder[] = []) {
  const row = new ActionRowBuilder<ButtonBuilder>();
  if (step > 1) row.addComponents(button("back", "◀ Back"));
  row.addComponents(...extra);
  row.addComponents(button("next", step >= 4 ? "Finish ▶" : "Next ▶", ButtonStyle.Primary));
  return row;
}

const channelLabel = (id: string | null) => id ? `<#${id}>` : "*not set*";
const roleLabel = (id: string | null) => id ? `<@&${id}>` : "*not set*";

export async function renderStep(step: number, guild: DiscordGuild, guildId: string, note: string) {
  const settings = await guildService.getSettings(guildId);
  if (!settings) throw new Error("Guild settings are missing.");
  const embed = new EmbedBuilder().setTitle(`⚜️ Quebec Gold setup — ${STEP_TITLES[step]}`).setColor(0xd4af37);
  const components: ActionRowBuilder<ButtonBuilder | ChannelSelectMenuBuilder | RoleSelectMenuBuilder>[] = [];

  if (step === 0) {
    embed.setDescription([
      "This takes about **2 minutes**. Every step is buttons and menus — nothing to type.",
      "",
      "**1. Roles** — who counts as Guild Master, Officer, Raid Leader, DKP Officer.",
      "**2. Channels** — where announcements, raid signups, and officer logs go.",
      "**3. Welcome** — optional welcome message and automatic roles for new people.",
      "**4. EPGP** — point values, raid reminders, weekly report.",
      "",
      "You can **run /setup again any time**: it shows what's already done and only changes what you click. Nothing gets deleted."
    ].join("\n"));
    components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
      button("next", "Start ▶", ButtonStyle.Primary),
      button("jump-summary", "Just show me the checklist")
    ));
  }

  if (step === 1) {
    await guild.roles.fetch();
    const has = (name: string) => guild.roles.cache.some((role) => role.name === name);
    const lines = [...REQUIRED_ROLES, ...OPTIONAL_ROLES].map((name) =>
      `${has(name) ? "✅" : REQUIRED_ROLES.includes(name) ? "❌" : "➖"} **${name}**${OPTIONAL_ROLES.includes(name) ? " (optional)" : ""}`);
    embed.setDescription([
      "The bot decides who can do what **by role name**. Server admins can always do everything.",
      "",
      ...lines,
      "",
      "• **Guild Master / Officer** — everything (settings, imports, moderation, loot).",
      "• **Raid Leader** — create and run raids, attendance, EP proposals.",
      "• **DKP Officer** — award and correct EP/GP.",
      "",
      "Press **Create missing roles**, then give them to your officers (right-click a member → Roles)."
    ].join("\n"));
    const missing = REQUIRED_ROLES.filter((name) => !has(name));
    components.push(navRow(1, [
      button("create-roles", missing.length ? `Create missing roles (${missing.length})` : "All roles exist", ButtonStyle.Success, missing.length === 0),
      button("give-gm", "Give me Guild Master", ButtonStyle.Secondary, !has(permissionRoles.guildMaster))
    ]));
  }

  if (step === 2) {
    embed.setDescription([
      "Pick a channel for each, **or press \"Create them for me\"** and I'll make all three (the log channel will be private to officers).",
      "",
      `📢 **Announcements** — raid started, boss kills, loot, EP awards, raid reports: ${channelLabel(settings.notifyChannelId)}`,
      `📅 **Raid signups** — signup posts that update live, and raid reminders: ${channelLabel(settings.raidSignupChannelId)}`,
      `🔒 **Officer log** — joins/leaves, moderation, bank and craft requests: ${channelLabel(settings.logChannelId)}`
    ].join("\n"));
    const select = (id: string, placeholder: string) => new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      new ChannelSelectMenuBuilder().setCustomId(`setup:${id}`).setPlaceholder(placeholder)
        .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setMinValues(1).setMaxValues(1));
    components.push(
      select("ch-notify", "📢 Pick the announcements channel"),
      select("ch-raid", "📅 Pick the raid signups channel"),
      select("ch-log", "🔒 Pick the officer log channel"),
      navRow(2, [button("create-channels", "Create them for me", ButtonStyle.Success)])
    );
  }

  if (step === 3) {
    embed.setDescription([
      "**Optional.** Skip with **Next** if you don't want these.",
      "",
      `👋 **Welcome channel** — greets new members and tells them to \`/apply\` or \`/character add\`: ${channelLabel(settings.welcomeChannelId)}`,
      `🆕 **Applicant role** — given automatically when someone joins: ${roleLabel(settings.applicantRoleId)}`,
      `🛡️ **Member role** — given when an application is approved: ${roleLabel(settings.memberRoleId)}`,
      "",
      "For auto-roles, **my role must be above those roles** (Server Settings → Roles, drag me higher). The final checklist tells you if it isn't."
    ].join("\n"));
    components.push(
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(new ChannelSelectMenuBuilder().setCustomId("setup:ch-welcome")
        .setPlaceholder("👋 Pick the welcome channel").setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setMinValues(1).setMaxValues(1)),
      new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(new RoleSelectMenuBuilder().setCustomId("setup:role-applicant")
        .setPlaceholder("🆕 Pick the applicant role").setMinValues(1).setMaxValues(1)),
      new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(new RoleSelectMenuBuilder().setCustomId("setup:role-member")
        .setPlaceholder("🛡️ Pick the member role").setMinValues(1).setMaxValues(1)),
      navRow(3, [button("welcome-off", "Turn welcome & auto-roles off")])
    );
  }

  if (step === 4) {
    embed.setDescription([
      "**EPGP points** (current):",
      `• Raid attendance: **${settings.attendanceDkp} EP** (late: ${settings.lateAttendanceDkp})`,
      `• Per boss killed: **${settings.bossKillDkp} EP**, full clear bonus: **${settings.epCompletionBonus} EP**`,
      `• Base GP: **${settings.baseGp}** (stops new players with tiny GP from topping the list)`,
      `• Weekly decay: **${Math.round(settings.epgpDecayPercent * 100)}%**`,
      "",
      "**Recommended:** 10 attendance / 5 late / 5 per boss / 10 full clear / base GP 100 / 10% decay.",
      "You can fine-tune any value later with `/config set`.",
      "",
      `⏰ **Raid reminders:** ${settings.raidReminderMinutes > 0 ? `on (${settings.raidReminderMinutes} min before start)` : "off"}`,
      `📊 **Weekly report:** ${settings.weeklyReportEnabled ? "on" : "off"}`
    ].join("\n"));
    components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
      button("epgp-recommended", "Use recommended values", ButtonStyle.Success),
      button("reminders", settings.raidReminderMinutes > 0 ? "Turn reminders off" : "Turn reminders on (60 min)"),
      button("weekly", settings.weeklyReportEnabled ? "Turn weekly report off" : "Turn weekly report on")
    ), navRow(4));
  }

  if (step === 5) {
    const checks = setupChecks(await gatherFacts(guild, guildId, settings));
    const done = setupComplete(checks);
    embed.setDescription([
      done ? "**Everything required is set up.** 🎉" : "**Almost there** — fix the ❌ items (each says how).",
      "",
      formatChecks(checks),
      "",
      "**Next steps**",
      "1. Everyone: `/character add` to link their WoW character.",
      `2. Officers: install the WoW addon — ${RELEASES_URL}`,
      "3. Try everything safely: `/testraid start` (fake raid, removed with `/testraid cleanup`).",
      "4. `/help` lists every command by role."
    ].join("\n").slice(0, 4000));
    components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
      button("post-guide", "Post a getting-started message for members", ButtonStyle.Success, !settings.notifyChannelId),
      button("restart", "Go through setup again"),
      button("close", "Close", ButtonStyle.Primary)
    ));
  }

  if (note) embed.addFields({ name: "Last action", value: note.slice(0, 1000) });
  return { embeds: [embed], components };
}

// ---------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------

async function createMissingRoles(guild: DiscordGuild): Promise<string> {
  await guild.roles.fetch();
  const created: string[] = [];
  for (const name of REQUIRED_ROLES) {
    if (guild.roles.cache.some((role) => role.name === name)) continue;
    await guild.roles.create({ name, reason: "Quebec Gold /setup" });
    created.push(name);
  }
  return created.length ? `Created roles: ${created.join(", ")}. Now give them to your officers.` : "All roles already existed.";
}

async function createChannels(guild: DiscordGuild, guildId: string): Promise<string> {
  const settings = await guildService.getSettings(guildId);
  await guild.roles.fetch();
  const officerRoles = guild.roles.cache.filter((role) => role.name === permissionRoles.guildMaster || role.name === permissionRoles.officer);
  const me = guild.members.me;
  const privateOverwrites: OverwriteResolvable[] = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    ...officerRoles.map((role) => ({ id: role.id, allow: [PermissionFlagsBits.ViewChannel] })),
    ...(me ? [{ id: me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] }] : [])
  ];
  const made: string[] = [];
  const update: { notifyChannelId?: string; raidSignupChannelId?: string; logChannelId?: string } = {};
  if (!settings?.notifyChannelId) {
    const channel = await guild.channels.create({ name: "qg-announcements", type: ChannelType.GuildText, topic: "Raid, boss, loot, and EPGP announcements from Quebec Gold" });
    update.notifyChannelId = channel.id;
    made.push(`<#${channel.id}>`);
  }
  if (!settings?.raidSignupChannelId) {
    const channel = await guild.channels.create({ name: "raid-signups", type: ChannelType.GuildText, topic: "Raid signups (/raid signup) and reminders" });
    update.raidSignupChannelId = channel.id;
    made.push(`<#${channel.id}>`);
  }
  if (!settings?.logChannelId) {
    const channel = await guild.channels.create({ name: "officer-log", type: ChannelType.GuildText, topic: "Officer log: joins, moderation, bank and craft requests", permissionOverwrites: privateOverwrites });
    update.logChannelId = channel.id;
    made.push(`<#${channel.id}> (officers only)`);
  }
  if (made.length) await guildService.updateSettings(guildId, update);
  return made.length ? `Created ${made.join(", ")}. Move or rename them however you like.` : "All three channels were already set. Pick different ones from the menus if you want.";
}

function gettingStartedPost(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("⚜️ Getting started with Quebec Gold")
    .setColor(0xd4af37)
    .setDescription([
      "**1. Link your character** — `/character add` (name and realm exactly as in game).",
      "**2. Sign up for raids** — `/raid signup` in the raid signups channel (Available or Maybe).",
      `**3. Install the addon** (optional but recommended) — download the zip from ${RELEASES_URL}, unzip into \`World of Warcraft\\_forever_\\Interface\\AddOns\\\`, restart the game, click the gold coin on the minimap.`,
      "**4. See your standing** — `/epgp balance`, `/profile`, `/raid progress`.",
      "**5. Need something?** — `/bank request` for the guild bank, `/craft request` for crafters.",
      "",
      "`/help` lists every command."
    ].join("\n"));
}

// ---------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------

export async function executeSetup(interaction: ChatInputCommandInteraction): Promise<void> {
  const context = await requireGuildContext(interaction);
  if (!context || !interaction.guild) return;
  if (!interaction.member || !hasPermission(interaction.member as GuildMember, "officer")) {
    await interaction.reply({ content: "Only server admins or Officers / Guild Masters can run setup. (The server owner always can.)", ephemeral: true });
    return;
  }
  const guild = interaction.guild;
  const guildId = context.guildId;

  if (interaction.options.getBoolean("status")) {
    await interaction.reply({ ...(await renderStep(5, guild, guildId, "")), ephemeral: true });
    return;
  }

  let step = 0;
  let note = "";
  await interaction.reply({ ...(await renderStep(step, guild, guildId, note)), ephemeral: true });
  const message = await interaction.fetchReply();
  const collector = message.createMessageComponentCollector({
    time: 15 * 60_000,
    filter: (i) => i.user.id === interaction.user.id
  });

  collector.on("collect", async (i: MessageComponentInteraction) => {
    const action = i.customId.replace("setup:", "");
    try {
      note = "";
      if (action === "close") {
        await i.update({ content: "Setup closed. Run `/setup` any time to come back, or `/setup status:true` for the checklist.", embeds: [], components: [] });
        collector.stop("closed");
        return;
      }
      // Acknowledge right away: Discord allows 3 seconds, and the database
      // (or creating roles/channels) can take longer than that.
      await i.deferUpdate();
      if (action === "next") step = Math.min(5, step + 1);
      else if (action === "back") step = Math.max(1, step - 1);
      else if (action === "jump-summary") step = 5;
      else if (action === "restart") step = 1;
      else {
        if (action === "create-roles") note = await createMissingRoles(guild);
        else if (action === "give-gm") {
          const role = guild.roles.cache.find((r) => r.name === permissionRoles.guildMaster);
          const member = await guild.members.fetch(i.user.id);
          if (role) {
            await member.roles.add(role, "Quebec Gold /setup");
            note = `Gave you ${role.name}.`;
          }
        } else if (action === "create-channels") note = await createChannels(guild, guildId);
        else if (i.isChannelSelectMenu()) {
          const channelId = i.values[0];
          const field = { "ch-notify": "notifyChannelId", "ch-raid": "raidSignupChannelId", "ch-log": "logChannelId", "ch-welcome": "welcomeChannelId" }[action];
          if (channelId && field) {
            await guildService.updateSettings(guildId, { [field]: channelId });
            note = `Saved <#${channelId}>.`;
          }
        } else if (i.isRoleSelectMenu()) {
          const roleId = i.values[0];
          const field = action === "role-applicant" ? "applicantRoleId" : "memberRoleId";
          if (roleId) {
            await guildService.updateSettings(guildId, { [field]: roleId });
            const check = botCanAssign(guild, roleId);
            note = check?.botCanAssign ? `Saved <@&${roleId}>.` : `Saved <@&${roleId}>, but **my role is below it** so I can't hand it out yet: Server Settings → Roles, drag my role above it.`;
          }
        } else if (action === "welcome-off") {
          await guildService.updateSettings(guildId, { welcomeChannelId: null, applicantRoleId: null, memberRoleId: null });
          note = "Welcome message and auto-roles are off.";
        } else if (action === "epgp-recommended") {
          await guildService.updateSettings(guildId, RECOMMENDED_EPGP);
          note = "Recommended EPGP values saved.";
        } else if (action === "reminders") {
          const settings = await guildService.getSettings(guildId);
          const on = (settings?.raidReminderMinutes ?? 0) > 0;
          await guildService.updateSettings(guildId, { raidReminderMinutes: on ? 0 : 60 });
          note = on ? "Raid reminders off." : "Raid reminders on: signed-up players get pinged 60 minutes before start.";
        } else if (action === "weekly") {
          const settings = await guildService.getSettings(guildId);
          await guildService.updateSettings(guildId, { weeklyReportEnabled: !settings?.weeklyReportEnabled });
          note = settings?.weeklyReportEnabled ? "Weekly report off." : "Weekly report on (posts in the announcements channel).";
        } else if (action === "post-guide") {
          const settings = await guildService.getSettings(guildId);
          const channel = settings?.notifyChannelId ? await guild.channels.fetch(settings.notifyChannelId).catch(() => null) : null;
          if (channel?.isTextBased()) {
            await channel.send({ embeds: [gettingStartedPost()] });
            note = `Posted the getting-started guide in <#${channel.id}>. Pin it there so new members see it.`;
          } else note = "Set an announcements channel first (step 2).";
        }
      }
      await interaction.editReply(await renderStep(step, guild, guildId, note));
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      note = `⚠️ That didn't work: ${text}${/Missing Permissions/i.test(text) ? " — I need the Manage Roles / Manage Channels permissions (or Administrator)." : ""}`;
      if (!i.replied && !i.deferred) await i.deferUpdate().catch(() => undefined);
      await interaction.editReply(await renderStep(step, guild, guildId, note)).catch(() => undefined);
    }
  });

  collector.on("end", async (_collected, reason) => {
    if (reason === "closed") return;
    await interaction.editReply({ content: "Setup timed out after 15 minutes — your choices are saved. Run `/setup` to continue.", embeds: [], components: [] }).catch(() => undefined);
  });
}

// Posted in the server's system channel when the bot is added, so whoever
// invited it knows the one command to run.
export async function greetNewGuild(guild: DiscordGuild): Promise<void> {
  const channel = guild.systemChannel;
  if (!channel) return;
  await channel.send({
    embeds: [new EmbedBuilder().setTitle("⚜️ Thanks for adding Quebec Gold!").setColor(0xd4af37)
      .setDescription("A server admin should run **`/setup`** now — it's a 2-minute, click-through guide (no typing).\n\n`/help` lists every command.")]
  }).catch(() => undefined);
}

// Printed in the bot's console window at startup, so whoever runs the bot
// sees right away if setup isn't finished.
export async function logSetupStatus(guilds: Iterable<DiscordGuild>): Promise<void> {
  for (const guild of guilds) {
    try {
      const record = await guildService.ensureGuild(guild.id, guild.name);
      const settings = await guildService.getSettings(record.id);
      if (!settings) continue;
      const checks = setupChecks(await gatherFacts(guild, record.id, settings));
      const missing = checks.filter((check) => !check.ok && !check.optional);
      if (missing.length === 0) console.info(`Setup complete for "${guild.name}".`);
      else console.warn(`Setup not finished for "${guild.name}" (${missing.map((check) => check.label).join("; ")}). Run /setup in Discord.`);
    } catch (error) {
      console.warn(`Could not check setup for "${guild.name}": ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
