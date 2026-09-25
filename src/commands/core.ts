import { SlashCommandBuilder, type ChatInputCommandInteraction, type GuildMember } from "discord.js";
import type { RaidRole } from "@prisma/client";
import { prisma } from "../database.js";
import { hasPermission } from "../permissions.js";
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
  .addSubcommand((sub) => sub.setName("rules").setDescription("Set this core's own EP rules for its raids (Raid Leaders). Empty options keep the guild default.")
    .addStringOption(coreOption)
    .addIntegerOption((o) => o.setName("attendance").setDescription("EP for attending").setMinValue(0))
    .addIntegerOption((o) => o.setName("late").setDescription("EP for arriving late").setMinValue(0))
    .addIntegerOption((o) => o.setName("boss").setDescription("EP per boss killed").setMinValue(0))
    .addIntegerOption((o) => o.setName("clear").setDescription("Bonus EP for a full clear").setMinValue(0))
    .addBooleanOption((o) => o.setName("reset").setDescription("Go back to the guild defaults for everything")))
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
    const reset = interaction.options.getBoolean("reset") ?? false;
    const pick = (name: string) => interaction.options.getInteger(name);
    const data = reset
      ? { attendanceEp: null, lateEp: null, bossEp: null, completionEp: null }
      : {
        ...(pick("attendance") !== null ? { attendanceEp: pick("attendance") } : {}),
        ...(pick("late") !== null ? { lateEp: pick("late") } : {}),
        ...(pick("boss") !== null ? { bossEp: pick("boss") } : {}),
        ...(pick("clear") !== null ? { completionEp: pick("clear") } : {})
      };
    const updated = Object.keys(data).length ? await prisma.raidCore.update({ where: { id: core.id }, data }) : core;
    const show = (value: number | null) => (value === null ? "guild default" : `${value} EP`);
    await interaction.reply({
      content: `**${core.name}** EP rules: attendance ${show(updated.attendanceEp)}, late ${show(updated.lateEp)}, per boss ${show(updated.bossEp)}, full clear ${show(updated.completionEp)}.`,
      ephemeral: true
    });
    return;
  }

  if (subcommand === "show") {
    const core = await coreService.byIdOrName(guildId, interaction.options.getString("core", true));
    const byRole = (role: RaidRole) => core.members.filter((entry) => entry.role === role).map((entry) => entry.member.displayName).join(", ") || "—";
    await interaction.reply({
      content: `**${core.name}**${core.description ? ` — ${core.description}` : ""}\n🎯 EP rules: attendance ${core.attendanceEp ?? "default"}, late ${core.lateEp ?? "default"}, boss ${core.bossEp ?? "default"}, clear ${core.completionEp ?? "default"}\n🛡️ Tanks: ${byRole("TANK")}\n💚 Healers: ${byRole("HEALER")}\n⚔️ DPS: ${byRole("DPS")}`,
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

  const core = await coreService.remove(guildId, interaction.options.getString("core", true));
  await removeCoreRosterMessage(interaction.guild, prisma, guildId, core.rosterMessageId);
  await interaction.reply({ content: `Deleted raid core **${core.name}**.`, ephemeral: true });
}
