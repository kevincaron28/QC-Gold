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
  StringSelectMenuBuilder,
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
import { sendWelcome, welcomeDelivery } from "../services/housekeeping.js";
import { isValidTimeZone } from "../services/raid-time.js";
import { updateDungeonLeaderboard } from "../services/dungeon-leaderboard.js";
import { syncAllCoreRosters } from "../services/raid-core.js";
import { asLang, t, type Lang } from "../i18n.js";
import { BRAND } from "../brand.js";

// Guided first-time setup. One private message that walks an admin through
// seven steps with buttons and dropdowns only (no IDs, no typing):
//   1 roles  2 channels  3 dungeon channels  4 extra channels  5 welcome  6 auto-roles  7 EPGP & automation  8 summary
// Safe to re-run any time: it shows what's already set and changes only
// what you click. `/setup status:true` shows just the checklist.

export const setupCommand = new SlashCommandBuilder()
  .setName("setup")
  .setDescription(`Guided setup for ${BRAND.name} (admins). Safe to run again any time.`)
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

const STEP_TITLES = [
  "Welcome", "Step 1 of 7 — Permission roles", "Step 2 of 7 — Channels", "Step 3 of 7 — Raid team channels",
  "Step 4 of 7 — Dungeon channels", "Step 5 of 7 — Welcome message", "Step 6 of 7 — New member roles",
  "Step 7 of 7 — EPGP, time & language", "All done"
];
const LAST_STEP = 7;
const SUMMARY_STEP = 8;

// Common choices; anything else can be set with /config timezone.
const TIMEZONES: [string, string][] = [
  ["Eastern — Quebec, Ontario, New York", "America/Toronto"],
  ["Atlantic — Maritimes", "America/Halifax"],
  ["Central — Manitoba, Texas", "America/Winnipeg"],
  ["Mountain — Alberta", "America/Edmonton"],
  ["Pacific — British Columbia, California", "America/Vancouver"],
  ["France / Central Europe", "Europe/Paris"],
  ["UK / Ireland", "Europe/London"],
  ["UTC", "UTC"]
];

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
  const autoRoles = [settings.applicantRoleId, settings.memberRoleId, ...settings.welcomeRoleIds]
    .filter((id): id is string => !!id)
    .map((id) => botCanAssign(guild, id))
    .filter((role): role is { name: string; botCanAssign: boolean } => role !== null);
  return {
    existingRoleNames: guild.roles.cache.map((role) => role.name),
    requiredRoleNames: REQUIRED_ROLES,
    notifyChannel: await channelFact(guild, settings.notifyChannelId),
    raidChannel: await channelFact(guild, settings.raidSignupChannelId),
    logChannel: await channelFact(guild, settings.logChannelId),
    raidLogChannel: await channelFact(guild, settings.raidLogChannelId),
    dungeonLeaderboardChannel: await channelFact(guild, settings.dungeonLeaderboardChannelId),
    welcomeChannel: welcomeDelivery(settings) === "DM" ? null : await channelFact(guild, settings.welcomeChannelId),
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
  row.addComponents(button("next", step >= LAST_STEP ? "Finish ▶" : "Next ▶", ButtonStyle.Primary));
  return row;
}

const channelLabel = (id: string | null) => id ? `<#${id}>` : "*not set*";
const roleLabel = (id: string | null) => id ? `<@&${id}>` : "*not set*";

export async function renderStep(step: number, guild: DiscordGuild, guildId: string, note: string) {
  const settings = await guildService.getSettings(guildId);
  if (!settings) throw new Error("Guild settings are missing.");
  const embed = new EmbedBuilder().setTitle(`${BRAND.emoji} ${BRAND.name} setup — ${STEP_TITLES[step]}`).setColor(BRAND.color);
  const components: ActionRowBuilder<ButtonBuilder | ChannelSelectMenuBuilder | RoleSelectMenuBuilder | StringSelectMenuBuilder>[] = [];

  if (step === 0) {
    embed.setDescription([
      "This takes about **2 minutes**. Every step is buttons and menus — nothing to type.",
      "",
      "**1. Roles** — who counts as Guild Master, Officer, Raid Leader, DKP Officer.",
      "**2. Channels** — where announcements, raid signups, raid logs, and officer logs go.",
      "**3. Raid team channels** — raid roster (cores), raid readiness (private), loot log, craft board (optional).",
      "**4. Dungeon channels** — dungeon leaderboard, signups and runs (optional).",
      "**5. Welcome** — optional welcome message (in a channel or by DM) with buttons to pick game roles.",
      "**6. New member roles** — optional automatic Applicant / Member roles.",
      "**7. EPGP, time & language** — point values, reminders, your timezone, English or French.",
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
      "Pick a channel for each, **or press \"Create them for me\"** and I'll make the missing ones (the log channel will be private to officers). **\"Create the whole WoW section\"** makes every channel from steps 2-4 at once, sorted into tidy categories (Guild, Raiding, Dungeons, Crafting, Officers) with the right permissions.",
      "",
      `📢 **Announcements** — raid started, boss kills, loot, EP awards: ${channelLabel(settings.notifyChannelId)}`,
      `📅 **Raid signups** — signup posts that update live, and raid reminders: ${channelLabel(settings.raidSignupChannelId)}`,
      `📜 **Raid logs** — the raid summary (report) posted after each raid: ${settings.raidLogChannelId ? `<#${settings.raidLogChannelId}>` : "same as announcements"}`,
      `🔒 **Officer log** — joins/leaves, moderation, bank and craft requests: ${channelLabel(settings.logChannelId)}`
    ].join("\n"));
    const select = (id: string, placeholder: string) => new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      new ChannelSelectMenuBuilder().setCustomId(`setup:${id}`).setPlaceholder(placeholder)
        .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setMinValues(1).setMaxValues(1));
    components.push(
      select("ch-notify", "📢 Pick the announcements channel"),
      select("ch-raid", "📅 Pick the raid signups channel"),
      select("ch-raidlog", "📜 Pick the raid logs channel"),
      select("ch-log", "🔒 Pick the officer log channel"),
      navRow(2, [
        button("create-channels", "Create them for me", ButtonStyle.Success),
        button("create-all-channels", "Create the whole WoW section", ButtonStyle.Success)
      ])
    );
  }

  const channelSelect = (id: string, placeholder: string) => new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
    new ChannelSelectMenuBuilder().setCustomId(`setup:${id}`).setPlaceholder(placeholder)
      .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setMinValues(1).setMaxValues(1));

  if (step === 3) {
    embed.setDescription([
      "**Optional.** Skip with **Next** if you don't want these. Pick a channel for each, **or press \"Create them for me\"**.",
      "",
      `⭐ **Raid roster** — one live message per raid core (\`/core create\`); core members get signup priority: ${channelLabel(settings.coreChannelId)}`,
      `🛡️ **Raid readiness** — private, officers and raid leaders only: who is ready for raid night: ${settings.readinessChannelId ? `<#${settings.readinessChannelId}>` : "*not set*"}`,
      `🎁 **Loot & EP log** — every loot award and EP/GP change: ${settings.lootChannelId ? `<#${settings.lootChannelId}>` : "same as announcements"}`,
      `🔨 **Craft board** — craft requests, so crafters see them (bank requests stay in the officer log): ${settings.craftChannelId ? `<#${settings.craftChannelId}>` : "the officer log"}`
    ].join("\n"));
    components.push(
      channelSelect("ch-core", "⭐ Pick the raid roster channel"),
      channelSelect("ch-readiness", "🛡️ Pick the raid readiness channel (keep it private)"),
      channelSelect("ch-loot", "🎁 Pick the loot & EP log channel"),
      channelSelect("ch-craft", "🔨 Pick the craft board channel"),
      navRow(3, [button("create-raidteam-channels", "Create them for me", ButtonStyle.Success)])
    );
  }

  if (step === 4) {
    embed.setDescription([
      "**Optional.** Skip with **Next** if you don't run the dungeon challenge.",
      "",
      `🏆 **Dungeon leaderboard** — one message I keep updated after every imported dungeon run: ${channelLabel(settings.dungeonLeaderboardChannelId)}`,
      `📝 **Dungeon signups** — where dungeon groups sign up (each group gets a temporary voice channel): ${channelLabel(settings.dungeonSignupChannelId)}`,
      `🏰 **Dungeon runs** — each completed dungeon and new records: ${settings.dungeonChannelId ? `<#${settings.dungeonChannelId}>` : "same as announcements"}`
    ].join("\n"));
    components.push(
      channelSelect("ch-dungeon-lb", "🏆 Pick the dungeon leaderboard channel"),
      channelSelect("ch-dungeon-signup", "📝 Pick the dungeon signups channel"),
      channelSelect("ch-dungeon", "🏰 Pick the dungeon runs channel"),
      navRow(4, [button("create-dungeon-channels", "Create them for me", ButtonStyle.Success)])
    );
  }

  if (step === 5) {
    const delivery = welcomeDelivery(settings);
    const offered = settings.welcomeRoleIds.map((id) => `<@&${id}>`).join(", ");
    embed.setDescription([
      "**Optional.** Skip with **Next** if you don't want a welcome message.",
      "",
      `📨 **Sent to:** ${delivery === "DM" ? "a private message (DM)" : delivery === "BOTH" ? "a private message and the welcome channel" : "the welcome channel"}`,
      `👋 **Welcome channel:** ${channelLabel(settings.welcomeChannelId)}${delivery === "DM" ? " (not needed for DM only; used if their DMs are closed)" : ""}`,
      `🎮 **Role buttons in the message:** ${offered || "*none*"}`,
      "",
      "Role buttons let new people pick what they're here for — for example one role per game, so they only see those channels. They can pick several, and click again to remove one. Pick up to 5 roles in the second menu (create the roles first in Server Settings → Roles).",
      "",
      "Press **Send me a preview** to see exactly what new people get."
    ].join("\n"));
    const deliveryButton = (value: string, label: string) => button(`delivery-${value}`, label, delivery === value ? ButtonStyle.Success : ButtonStyle.Secondary);
    components.push(
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(new ChannelSelectMenuBuilder().setCustomId("setup:ch-welcome")
        .setPlaceholder("👋 Pick the welcome channel").setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setMinValues(1).setMaxValues(1)),
      new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(new RoleSelectMenuBuilder().setCustomId("setup:welcome-roles")
        .setPlaceholder("🎮 Roles people can pick (up to 5; pick none to remove)").setMinValues(0).setMaxValues(5)),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        deliveryButton("CHANNEL", "Post in channel"),
        deliveryButton("DM", "Private message"),
        deliveryButton("BOTH", "Both"),
        button("welcome-preview", "Send me a preview", ButtonStyle.Primary)
      ),
      navRow(5, [button("welcome-off", "Turn welcome off")])
    );
  }

  if (step === 6) {
    embed.setDescription([
      "**Optional.** Skip with **Next** if you don't use these.",
      "",
      `🆕 **Applicant role** — given automatically when someone joins: ${roleLabel(settings.applicantRoleId)}`,
      `🛡️ **Member role** — given when an application is approved (\`/application approve\`): ${roleLabel(settings.memberRoleId)}`,
      "",
      "**My role must be above these roles** (Server Settings → Roles, drag me higher). The final checklist tells you if it isn't."
    ].join("\n"));
    components.push(
      new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(new RoleSelectMenuBuilder().setCustomId("setup:role-applicant")
        .setPlaceholder("🆕 Pick the applicant role").setMinValues(1).setMaxValues(1)),
      new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(new RoleSelectMenuBuilder().setCustomId("setup:role-member")
        .setPlaceholder("🛡️ Pick the member role").setMinValues(1).setMaxValues(1)),
      navRow(6, [button("autoroles-off", "Turn auto-roles off")])
    );
  }

  if (step === 7) {
    const tzLabel = TIMEZONES.find(([, value]) => value === settings.timezone)?.[0] ?? settings.timezone;
    embed.setDescription([
      "**EPGP points** (current):",
      `• Raid attendance: **${settings.attendanceDkp} EP** (late: ${settings.lateAttendanceDkp})`,
      `• Per boss killed: **${settings.bossKillDkp} EP**, full clear bonus: **${settings.epCompletionBonus} EP**`,
      `• Base GP: **${settings.baseGp}** (stops new players with tiny GP from topping the list)`,
      `• Weekly decay: **${Math.round(settings.epgpDecayPercent * 100)}%**`,
      "**Recommended:** 10 attendance / 5 late / 5 per boss / 10 full clear / base GP 100 / 10% decay. Fine-tune later with `/config set`.",
      "",
      `⏰ **Raid reminders:** ${settings.raidReminderMinutes > 0 ? `on (${settings.raidReminderMinutes} min before start)` : "off"}   📊 **Weekly report:** ${settings.weeklyReportEnabled ? "on" : "off"}   🤖 **Auto-apply uploads:** ${settings.autoApplyImports ? "on" : "off"}`,
      `🕗 **Timezone** (for typing raid times like "friday 8pm"): **${tzLabel}**`,
      `🗣️ **Language** for member messages: **${settings.language === "fr" ? "Français" : "English"}**`
    ].join("\n"));
    components.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        button("epgp-recommended", "Use recommended values", ButtonStyle.Success),
        button("reminders", settings.raidReminderMinutes > 0 ? "Turn reminders off" : "Turn reminders on (60 min)"),
        button("weekly", settings.weeklyReportEnabled ? "Turn weekly report off" : "Turn weekly report on"),
        button("auto-import", settings.autoApplyImports ? "Auto-apply uploads: on" : "Auto-apply uploads: off", settings.autoApplyImports ? ButtonStyle.Success : ButtonStyle.Secondary)
      ),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId("setup:tz")
        .setPlaceholder("🕗 Pick your timezone")
        .addOptions(TIMEZONES.map(([label, value]) => ({ label, value, default: value === settings.timezone })))),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId("setup:lang")
        .setPlaceholder("🗣️ Language / Langue")
        .addOptions(
          { label: "English", value: "en", default: settings.language !== "fr" },
          { label: "Français", value: "fr", default: settings.language === "fr" }
        )),
      navRow(7)
    );
  }

  if (step === SUMMARY_STEP) {
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
      "3. Raid leaders: `/core setup` builds a raid core (name, players, rules) with menus; then `/raid create core:<name>`.",
      "4. Try everything safely: `/testraid start` (fake raid, removed with `/testraid cleanup`).",
      "5. `/help` lists every command by role."
    ].join("\n").slice(0, 4000));
    components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
      button("post-guide", "Post a getting-started message for members", ButtonStyle.Success, !settings.notifyChannelId),
      button("organize", "Tidy my channels into categories"),
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
    await guild.roles.create({ name, reason: `${BRAND.name} /setup` });
    created.push(name);
  }
  return created.length ? `Created roles: ${created.join(", ")}. Now give them to your officers.` : "All roles already existed.";
}

type ChannelField = "notifyChannelId" | "raidSignupChannelId" | "raidLogChannelId" | "logChannelId"
  | "dungeonLeaderboardChannelId" | "dungeonSignupChannelId" | "dungeonChannelId"
  | "lootChannelId" | "craftChannelId" | "readinessChannelId" | "coreChannelId";

// Access: "open" everyone talks; "readonly" everyone reads, only the bot and
// leadership post (signup channels are read-only too: people use the buttons);
// "officers" hidden from everyone but Guild Master/Officer; "leaders" hidden
// from everyone but the leadership roles.
type Access = "open" | "readonly" | "officers" | "leaders";
type CategoryKey = "guild" | "raid" | "dungeon" | "craft" | "officers";

const CATEGORY_NAMES: Record<CategoryKey, string> = {
  guild: "⚜️ Guild", raid: "⚔️ Raiding", dungeon: "🏰 Dungeons", craft: "🔨 Crafting", officers: "🔒 Officers"
};

const CHANNEL_SPECS: Record<ChannelField, { name: string; topic: string; access: Access; category: CategoryKey }> = {
  notifyChannelId: { name: `${BRAND.channelPrefix}-announcements`, topic: `Raid, boss and guild announcements from ${BRAND.name}`, access: "readonly", category: "guild" },
  raidSignupChannelId: { name: "raid-signups", topic: "Raid signups: use the buttons under each raid post", access: "readonly", category: "raid" },
  coreChannelId: { name: "raid-roster", topic: "Raid core rosters: core members get signup priority", access: "readonly", category: "raid" },
  raidLogChannelId: { name: "raid-logs", topic: "Raid summaries and Warcraft Logs, posted after each raid", access: "readonly", category: "raid" },
  lootChannelId: { name: "loot-log", topic: "Loot awards and EP/GP changes", access: "readonly", category: "raid" },
  dungeonSignupChannelId: { name: "dungeon-signups", topic: "Dungeon groups: use the buttons under each post", access: "readonly", category: "dungeon" },
  dungeonLeaderboardChannelId: { name: "dungeon-leaderboard", topic: "Dungeon challenge standings, updated automatically", access: "readonly", category: "dungeon" },
  dungeonChannelId: { name: "dungeon-runs", topic: "Completed dungeon runs and new records", access: "readonly", category: "dungeon" },
  craftChannelId: { name: "craft-board", topic: "Craft requests (/craft request): crafters claim them here", access: "open", category: "craft" },
  logChannelId: { name: "officer-log", topic: "Officer log: joins, moderation, bank and craft requests", access: "officers", category: "officers" },
  readinessChannelId: { name: "raid-readiness", topic: "Who is ready for raid night: gear and consumable checks (officers and raid leaders only)", access: "leaders", category: "officers" }
};

const CORE_CHANNELS: ChannelField[] = ["notifyChannelId", "raidSignupChannelId", "raidLogChannelId", "logChannelId"];
const RAIDTEAM_CHANNELS: ChannelField[] = ["coreChannelId", "readinessChannelId", "lootChannelId", "craftChannelId"];
const DUNGEON_CHANNELS: ChannelField[] = ["dungeonLeaderboardChannelId", "dungeonSignupChannelId", "dungeonChannelId"];
const ALL_CHANNELS: ChannelField[] = [...CORE_CHANNELS, ...RAIDTEAM_CHANNELS, ...DUNGEON_CHANNELS];

// The category for a group of channels; created once and reused (by name).
async function ensureCategory(guild: DiscordGuild, key: CategoryKey) {
  await guild.channels.fetch();
  const name = CATEGORY_NAMES[key];
  const existing = guild.channels.cache.find((channel) => channel.type === ChannelType.GuildCategory && channel.name === name);
  return existing ?? guild.channels.create({ name, type: ChannelType.GuildCategory, reason: `${BRAND.name} /setup` });
}

// The permission overwrites for a kind of channel. Leadership can always
// post in read-only channels; the bot can always post everywhere it makes.
function overwritesFor(guild: DiscordGuild, access: Access): OverwriteResolvable[] | undefined {
  const named = (names: string[]) => guild.roles.cache.filter((role) => names.includes(role.name));
  const officers = named([permissionRoles.guildMaster, permissionRoles.officer]);
  const leaders = named([permissionRoles.guildMaster, permissionRoles.officer, permissionRoles.raidLeader, permissionRoles.lootLeader, permissionRoles.classLeader]);
  const me = guild.members.me;
  const bot: OverwriteResolvable[] = me
    ? [{ id: me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] }]
    : [];
  if (access === "officers" || access === "leaders") {
    const who = access === "officers" ? officers : leaders;
    return [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      ...who.map((role) => ({ id: role.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] })),
      ...bot
    ];
  }
  if (access === "readonly") {
    return [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.CreatePrivateThreads] },
      ...officers.map((role) => ({ id: role.id, allow: [PermissionFlagsBits.SendMessages] })),
      ...bot
    ];
  }
  return undefined;
}

// Creates only the channels in `fields` that aren't set yet, each in its own
// category with the right permissions; never touches ones that are set.
async function createSectionChannels(guild: DiscordGuild, guildId: string, fields: ChannelField[]): Promise<string> {
  const settings = await guildService.getSettings(guildId);
  const missing = fields.filter((field) => !settings?.[field]);
  if (missing.length === 0) return "Those channels were already set. Pick different ones from the menus if you want.";
  await guild.roles.fetch();
  const made: string[] = [];
  const update: Partial<Record<ChannelField, string>> = {};
  for (const field of missing) {
    const spec = CHANNEL_SPECS[field];
    const category = await ensureCategory(guild, spec.category);
    const overwrites = overwritesFor(guild, spec.access);
    const channel = await guild.channels.create({
      name: spec.name, type: ChannelType.GuildText, topic: spec.topic, parent: category.id,
      ...(overwrites ? { permissionOverwrites: overwrites } : {})
    });
    update[field] = channel.id;
    made.push(`<#${channel.id}>${spec.access === "officers" ? " (officers only)" : spec.access === "leaders" ? " (officers and raid leaders only)" : ""}`);
  }
  await guildService.updateSettings(guildId, update);
  if (update.dungeonLeaderboardChannelId) await updateDungeonLeaderboard(guild);
  if (update.coreChannelId) await syncAllCoreRosters(guild, prisma, guildId);
  return `Created ${made.join(", ")} in tidy categories. Move or rename them however you like.`;
}

// Tidies channels the bot made earlier (same name as the standard one):
// moves each into its category and resets its permissions to the standard
// set. Channels you picked yourself (any other name) are left alone.
async function organizeChannels(guild: DiscordGuild, guildId: string): Promise<string> {
  const settings = await guildService.getSettings(guildId);
  if (!settings) return "No settings found.";
  await guild.roles.fetch();
  const tidied: string[] = [];
  const skipped: string[] = [];
  for (const field of ALL_CHANNELS) {
    const channelId = settings[field];
    if (!channelId) continue;
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || channel.type !== ChannelType.GuildText) continue;
    const spec = CHANNEL_SPECS[field];
    if (channel.name !== spec.name) { skipped.push(`<#${channel.id}>`); continue; }
    const category = await ensureCategory(guild, spec.category);
    const overwrites = overwritesFor(guild, spec.access);
    await channel.edit({ parent: category.id, permissionOverwrites: overwrites ?? [], reason: `${BRAND.name} /setup organize` });
    tidied.push(`<#${channel.id}>`);
  }
  return `${tidied.length ? `Tidied ${tidied.join(", ")}.` : "Nothing of mine to tidy yet: run \"Create the whole WoW section\" in step 2 first."}`
    + `${skipped.length ? ` Left alone (renamed or your own): ${skipped.join(", ")}.` : ""}`;
}

function gettingStartedPost(lang: Lang): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(t(lang, "guide.title"))
    .setColor(0xd4af37)
    .setDescription(t(lang, "guide.body", { url: RELEASES_URL }));
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
    await interaction.reply({ ...(await renderStep(SUMMARY_STEP, guild, guildId, "")), ephemeral: true });
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
      if (action === "next") step = Math.min(SUMMARY_STEP, step + 1);
      else if (action === "back") step = Math.max(1, step - 1);
      else if (action === "jump-summary") step = SUMMARY_STEP;
      else if (action === "restart") step = 1;
      else {
        if (action === "create-roles") note = await createMissingRoles(guild);
        else if (action === "give-gm") {
          const role = guild.roles.cache.find((r) => r.name === permissionRoles.guildMaster);
          const member = await guild.members.fetch(i.user.id);
          if (role) {
            await member.roles.add(role, `${BRAND.name} /setup`);
            note = `Gave you ${role.name}.`;
          }
        } else if (action === "create-channels") note = await createSectionChannels(guild, guildId, CORE_CHANNELS);
        else if (action === "create-raidteam-channels") note = await createSectionChannels(guild, guildId, RAIDTEAM_CHANNELS);
        else if (action === "create-dungeon-channels") note = await createSectionChannels(guild, guildId, DUNGEON_CHANNELS);
        else if (action === "create-all-channels") note = await createSectionChannels(guild, guildId, ALL_CHANNELS);
        else if (action === "organize") note = await organizeChannels(guild, guildId);
        else if (i.isChannelSelectMenu()) {
          const channelId = i.values[0];
          const field = { "ch-notify": "notifyChannelId", "ch-raid": "raidSignupChannelId", "ch-raidlog": "raidLogChannelId", "ch-log": "logChannelId", "ch-welcome": "welcomeChannelId", "ch-dungeon": "dungeonChannelId", "ch-dungeon-lb": "dungeonLeaderboardChannelId", "ch-dungeon-signup": "dungeonSignupChannelId", "ch-core": "coreChannelId", "ch-readiness": "readinessChannelId", "ch-loot": "lootChannelId", "ch-craft": "craftChannelId" }[action];
          if (channelId && field) {
            await guildService.updateSettings(guildId, { [field]: channelId });
            note = `Saved <#${channelId}>.`;
            if (field === "coreChannelId") await syncAllCoreRosters(guild, prisma, guildId);
            if (field === "dungeonLeaderboardChannelId") {
              await guildService.updateSettings(guildId, { dungeonLeaderboardMessageId: null });
              await updateDungeonLeaderboard(guild);
            }
          }
        } else if (i.isRoleSelectMenu() && action === "welcome-roles") {
          await guildService.updateSettings(guildId, { welcomeRoleIds: i.values.slice(0, 5) });
          const blocked = i.values.map((id) => botCanAssign(guild, id)).filter((role) => role && !role.botCanAssign).map((role) => role?.name);
          note = i.values.length
            ? `Welcome buttons: ${i.values.map((id) => `<@&${id}>`).join(", ")}.${blocked.length ? ` **My role is below ${blocked.join(", ")}**, so I can't hand those out yet: Server Settings → Roles, drag my role above them.` : ""}`
            : "Removed the role buttons from the welcome message.";
        } else if (i.isStringSelectMenu() && action === "tz") {
          const timezone = i.values[0];
          if (timezone && isValidTimeZone(timezone)) {
            await guildService.updateSettings(guildId, { timezone });
            note = `Timezone saved: raid times like "friday 8pm" now mean 8pm ${timezone.replace("_", " ")}.`;
          }
        } else if (i.isStringSelectMenu() && action === "lang") {
          const language = i.values[0] === "fr" ? "fr" : "en";
          await guildService.updateSettings(guildId, { language });
          note = language === "fr" ? "Langue : français pour les messages aux membres." : "Language: English for member messages.";
        } else if (action.startsWith("delivery-")) {
          const value = action.slice("delivery-".length);
          await guildService.updateSettings(guildId, { welcomeDelivery: value });
          note = value === "DM" ? "New members get the welcome by private message (the channel is used only if their DMs are closed)."
            : value === "BOTH" ? "New members get the welcome by private message and in the welcome channel."
              : "The welcome is posted in the welcome channel.";
        } else if (action === "welcome-preview") {
          const current = await guildService.getSettings(guildId);
          const member = await guild.members.fetch(i.user.id);
          const sent = current ? await sendWelcome(guild, member, current) : { dm: false, channel: false };
          note = sent.dm || sent.channel
            ? `Preview sent${sent.dm ? " to your DMs" : ""}${sent.dm && sent.channel ? " and" : ""}${sent.channel ? " in the welcome channel" : ""}. Try the buttons!`
            : "Nothing was sent: pick a welcome channel, or choose Private message. (If you chose DM, your DMs from server members may be off.)";
        } else if (action === "autoroles-off") {
          await guildService.updateSettings(guildId, { applicantRoleId: null, memberRoleId: null });
          note = "Automatic Applicant / Member roles are off.";
        } else if (i.isRoleSelectMenu()) {
          const roleId = i.values[0];
          const field = action === "role-applicant" ? "applicantRoleId" : "memberRoleId";
          if (roleId) {
            await guildService.updateSettings(guildId, { [field]: roleId });
            const check = botCanAssign(guild, roleId);
            note = check?.botCanAssign ? `Saved <@&${roleId}>.` : `Saved <@&${roleId}>, but **my role is below it** so I can't hand it out yet: Server Settings → Roles, drag my role above it.`;
          }
        } else if (action === "welcome-off") {
          await guildService.updateSettings(guildId, { welcomeChannelId: null, welcomeDelivery: "CHANNEL", welcomeRoleIds: [] });
          note = "Welcome message is off.";
        } else if (action === "epgp-recommended") {
          await guildService.updateSettings(guildId, RECOMMENDED_EPGP);
          note = "Recommended EPGP values saved.";
        } else if (action === "reminders") {
          const settings = await guildService.getSettings(guildId);
          const on = (settings?.raidReminderMinutes ?? 0) > 0;
          await guildService.updateSettings(guildId, { raidReminderMinutes: on ? 0 : 60 });
          note = on ? "Raid reminders off." : "Raid reminders on: signed-up players get pinged 60 minutes before start.";
        } else if (action === "auto-import") {
          const current = await guildService.getSettings(guildId);
          await guildService.updateSettings(guildId, { autoApplyImports: !current?.autoApplyImports });
          note = current?.autoApplyImports
            ? "Auto-apply is off: officers apply uploads with /import-apply."
            : "Auto-apply is on: what the companion uploads is applied and announced right away.";
        } else if (action === "weekly") {
          const settings = await guildService.getSettings(guildId);
          await guildService.updateSettings(guildId, { weeklyReportEnabled: !settings?.weeklyReportEnabled });
          note = settings?.weeklyReportEnabled ? "Weekly report off." : "Weekly report on (posts in the announcements channel).";
        } else if (action === "post-guide") {
          const settings = await guildService.getSettings(guildId);
          const channel = settings?.notifyChannelId ? await guild.channels.fetch(settings.notifyChannelId).catch(() => null) : null;
          if (channel?.isTextBased()) {
            await channel.send({ embeds: [gettingStartedPost(asLang(settings?.language))] });
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
    embeds: [new EmbedBuilder().setTitle(`${BRAND.emoji} Thanks for adding ${BRAND.name}!`).setColor(BRAND.color)
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
