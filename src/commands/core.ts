import { SlashCommandBuilder, type ChatInputCommandInteraction, type GuildMember } from "discord.js";
import type { RaidRole } from "@prisma/client";
import { prisma } from "../database.js";
import { hasPermission } from "../permissions.js";
import { describeRules, effectiveRules } from "../services/core-rules.js";
import { createRaidCoreService, removeCoreRosterMessage, syncCoreRoster } from "../services/raid-core.js";
import { guildService, requireGuildContext } from "./context.js";

const coreService = createRaidCoreService(prisma);

const coreOption = (o: import("discord.js").SlashCommandStringOption) =>
  o.setName("core").setDescription("Raid core (start typing its name)").setAutocomplete(true).setRequired(true);
const roleOption = (o: import("discord.js").SlashCommandStringOption) =>
  o.setName("role").setDescription("Their role in the core (default DPS)").addChoices(
    { name: "Tank", value: "TANK" }, { name: "Healer", value: "HEALER" }, { name: "DPS", value: "DPS" });

export const coreCommand = new SlashCommandBuilder()
  .setName("core")
  .setDescription("Raid cores: named rosters whose members get priority at that core's raid signups.")
  .addSubcommand((sub) => sub.setName("create").setDescription("Create a raid core (Raid Leaders).")
    .addStringOption((o) => o.setName("name").setDescription("e.g. Tuesday MC core").setMinLength(2).setMaxLength(50).setRequired(true))
    .addStringOption((o) => o.setName("description").setDescription("Optional: schedule, goals").setMaxLength(300)))
  .addSubcommand((sub) => sub.setName("add").setDescription("Add a player to a core (Raid Leaders).")
    .addStringOption(coreOption)
    .addUserOption((o) => o.setName("player").setDescription("Discord member").setRequired(true))
    .addStringOption(roleOption))
  .addSubcommand((sub) => sub.setName("remove").setDescription("Remove a player from a core (Raid Leaders).")
    .addStringOption(coreOption)
    .addUserOption((o) => o.setName("player").setDescription("Discord member").setRequired(true)))
  .addSubcommand((sub) => sub.setName("rules").setDescription("A core's point rules. Every core follows the guild's rules unless you change a value here.")
    .addStringOption(coreOption)
    .addIntegerOption((o) => o.setName("attendance").setDescription("EP for attending").setMinValue(0))
    .addIntegerOption((o) => o.setName("late").setDescription("EP for arriving late").setMinValue(0))
    .addIntegerOption((o) => o.setName("boss").setDescription("EP per boss killed").setMinValue(0))
    .addIntegerOption((o) => o.setName("clear").setDescription("Bonus EP for a full clear").setMinValue(0))
    .addIntegerOption((o) => o.setName("base_gp").setDescription("Base GP for this core's PR").setMinValue(0))
    .addIntegerOption((o) => o.setName("decay").setDescription("Decay percent for this core's /epgp decay").setMinValue(0).setMaxValue(100))
    .addStringOption((o) => o.setName("loot_mode").setDescription("How this core's loot is decided").addChoices(
      { name: "Follow the guild", value: "DEFAULT" }, { name: "GP bids", value: "EPGP" }, { name: "Loot council", value: "COUNCIL" }))
    .addStringOption((o) => o.setName("pool").setDescription("Points: shared guild pool, or this core's own pool (applies to future points)").addChoices(
      { name: "Shared guild pool", value: "shared" }, { name: "Its own pool", value: "separate" }))
    .addBooleanOption((o) => o.setName("reset").setDescription("Go back to the guild defaults for every rule (points already in a pool stay there)")))
  .addSubcommand((sub) => sub.setName("show").setDescription("Show one core's roster.")
    .addStringOption(coreOption))
  .addSubcommand((sub) => sub.setName("list").setDescription("All raid cores and how many players each has."))
  .addSubcommand((sub) => sub.setName("post").setDescription("Refresh the roster messages in the roster channel (Raid Leaders).")
    .addStringOption((o) => o.setName("core").setDescription("One core (default: all)").setAutocomplete(true)))
  .addSubcommand((sub) => sub.setName("delete").setDescription("Delete a core (Raid Leaders). Raids created for it keep their signups.")
    .addStringOption(coreOption));

function requireRaidLeader(interaction: ChatInputCommandInteraction): void {
  if (!interaction.member || !hasPermission(interaction.member as GuildMember, "raidLeader")) {
    throw new Error("Only Raid Leaders, Officers, Guild Masters, or Administrators can manage raid cores.");
  }
}

export async function executeCore(interaction: ChatInputCommandInteraction): Promise<void> {
  const context = await requireGuildContext(interaction);
  if (!context) return;
  const guildId = context.guildId;
  const subcommand = interaction.options.getSubcommand();
  if (["create", "add", "remove", "post", "delete", "rules"].includes(subcommand)) requireRaidLeader(interaction);

  if (subcommand === "create") {
    const core = await coreService.create(guildId, interaction.options.getString("name", true), interaction.options.getString("description"));
    const posted = await syncCoreRoster(interaction.guild, prisma, guildId, core.id);
    await interaction.reply({
      content: `Created raid core **${core.name}**. Add players with \`/core add\`, and create its raids with \`/raid create core:${core.name}\`.`
        + (posted ? "" : " (Set a roster channel in `/setup` or `/config core-channel` to show the roster there.)"),
      ephemeral: true
    });
    return;
  }

  if (subcommand === "add" || subcommand === "remove") {
    const user = interaction.options.getUser("player", true);
    const target = await guildService.ensureMember(guildId, user.id, user.username);
    const core = subcommand === "add"
      ? await coreService.addMember(guildId, interaction.options.getString("core", true), target.id, (interaction.options.getString("role") ?? "DPS") as RaidRole)
      : await coreService.removeMember(guildId, interaction.options.getString("core", true), target.id);
    await syncCoreRoster(interaction.guild, prisma, guildId, core.id);
    await interaction.reply({
      content: subcommand === "add" ? `Added ${user.username} to **${core.name}**.` : `Removed ${user.username} from **${core.name}**.`,
      ephemeral: true
    });
    return;
  }

  if (subcommand === "rules") {
    const core = await coreService.byIdOrName(guildId, interaction.options.getString("core", true));
    const settings = await guildService.getSettings(guildId);
    const number = (name: string) => interaction.options.getInteger(name);
    const data: Record<string, number | string | boolean | null> = {};
    if (interaction.options.getBoolean("reset")) {
      Object.assign(data, { attendanceEp: null, lateEp: null, bossEp: null, completionEp: null, baseGp: null, decayPercent: null, lootMode: null });
    } else {
      for (const [option, field] of [["attendance", "attendanceEp"], ["late", "lateEp"], ["boss", "bossEp"], ["clear", "completionEp"], ["base_gp", "baseGp"]] as const) {
        if (number(option) !== null) data[field] = number(option);
      }
      if (number("decay") !== null) data["decayPercent"] = (number("decay") ?? 0) / 100;
      const mode = interaction.options.getString("loot_mode");
      if (mode) data["lootMode"] = mode === "DEFAULT" ? null : mode;
    }
    const pool = interaction.options.getString("pool");
    if (pool === "separate" && !core.separatePool) data["separatePool"] = true;
    if (pool === "shared" && core.separatePool) {
      // Going back to the shared pool would strand the points already in the core's pool.
      const stranded = await prisma.epgpTransaction.count({ where: { guildId, coreId: core.id } });
      if (stranded > 0) throw new Error(`${core.name} already has ${stranded} entries in its own pool. Those points would disappear from view, so it stays separate.`);
      data["separatePool"] = false;
    }
    const updated = Object.keys(data).length ? await prisma.raidCore.update({ where: { id: core.id }, data }) : core;
    const note = pool === "separate" && data["separatePool"] === true
      ? "\nFrom now on this core's raids pay EP and GP into its own pool (`/epgp balance core:...`). Points already in the guild pool stay there."
      : "";
    await interaction.reply({ content: describeRules(effectiveRules(settings, updated), core.name) + note, ephemeral: true });
    return;
  }

  if (subcommand === "show") {
    const core = await coreService.byIdOrName(guildId, interaction.options.getString("core", true));
    const byRole = (role: RaidRole) => core.members.filter((entry) => entry.role === role).map((entry) => entry.member.displayName).join(", ") || "—";
    const rules = describeRules(effectiveRules(await guildService.getSettings(guildId), core), core.name);
    await interaction.reply({
      content: `${core.description ? `${core.description}\n` : ""}${rules}\n🛡️ Tanks: ${byRole("TANK")}\n💚 Healers: ${byRole("HEALER")}\n⚔️ DPS: ${byRole("DPS")}`,
      ephemeral: true
    });
    return;
  }

  if (subcommand === "list") {
    const cores = await coreService.list(guildId);
    await interaction.reply({
      content: cores.length
        ? cores.map((core) => `• **${core.name}** — ${core.members.length} player${core.members.length === 1 ? "" : "s"}, ${core._count.raids} raid${core._count.raids === 1 ? "" : "s"}`).join("\n")
        : "No raid cores yet. Create one with `/core create`.",
      ephemeral: true
    });
    return;
  }

  if (subcommand === "post") {
    const value = interaction.options.getString("core");
    const settings = await guildService.getSettings(guildId);
    if (!settings?.coreChannelId) throw new Error("No roster channel is set. Use /setup or /config core-channel first.");
    const cores = value ? [await coreService.byIdOrName(guildId, value)] : await coreService.list(guildId);
    let posted = 0;
    for (const core of cores) if (await syncCoreRoster(interaction.guild, prisma, guildId, core.id)) posted++;
    await interaction.reply({ content: `Refreshed ${posted} roster message${posted === 1 ? "" : "s"} in <#${settings.coreChannelId}>.`, ephemeral: true });
    return;
  }

  const toDelete = await coreService.byIdOrName(guildId, interaction.options.getString("core", true));
  const pooled = toDelete.separatePool ? await prisma.epgpTransaction.count({ where: { guildId, coreId: toDelete.id } }) : 0;
  if (pooled > 0) throw new Error(`${toDelete.name} has ${pooled} entries in its own point pool. Deleting it would orphan them, so it can't be deleted while it keeps its own points.`);
  const core = await coreService.remove(guildId, toDelete.id);
  await removeCoreRosterMessage(interaction.guild, prisma, guildId, core.rosterMessageId);
  await interaction.reply({ content: `Deleted raid core **${core.name}**.`, ephemeral: true });
}
