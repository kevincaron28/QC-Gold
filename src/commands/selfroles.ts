import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type GuildMember,
  type Role
} from "discord.js";
import { hasPermission } from "../permissions.js";
import { selfRoleProblem } from "../services/selfrole.js";

export const SELF_ROLE_PREFIX = "selfrole:";

export const selfRolesCommand = new SlashCommandBuilder()
  .setName("selfroles")
  .setDescription("Post a panel of buttons members can press to toggle roles (officers only).")
  .addStringOption((o) => o.setName("title").setDescription("Panel heading").setRequired(true).setMaxLength(200))
  .addRoleOption((o) => o.setName("role1").setDescription("First role").setRequired(true))
  .addRoleOption((o) => o.setName("role2").setDescription("Second role"))
  .addRoleOption((o) => o.setName("role3").setDescription("Third role"))
  .addRoleOption((o) => o.setName("role4").setDescription("Fourth role"))
  .addRoleOption((o) => o.setName("role5").setDescription("Fifth role"));

export async function executeSelfRoles(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild || !interaction.member || !hasPermission(interaction.member as GuildMember, "officer")) {
    await interaction.reply({ content: "Only Officers, Guild Masters, or administrators can create role panels.", ephemeral: true });
    return;
  }
  const guild = interaction.guild;
  const roles = ["role1", "role2", "role3", "role4", "role5"]
    .map((name) => interaction.options.getRole(name))
    .filter((role): role is NonNullable<typeof role> => role !== null);

  for (const role of roles) {
    // getRole returns a full Role when cached, or a raw API role (permissions as a string) otherwise.
    const permissions = typeof role.permissions === "string" ? BigInt(role.permissions) : role.permissions.bitfield;
    const problem = selfRoleProblem({ id: role.id, managed: role.managed, permissions }, guild.id);
    if (problem) throw new Error(`${role.name}: ${problem}`);
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    roles.map((role) => new ButtonBuilder()
      .setCustomId(`${SELF_ROLE_PREFIX}${role.id}`)
      .setLabel(role.name.slice(0, 80))
      .setStyle(ButtonStyle.Secondary))
  );
  await interaction.reply({ content: `**${interaction.options.getString("title", true)}**\nPress a button to add or remove that role.`, components: [row] });
}

export async function handleSelfRoleButton(interaction: ButtonInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  const roleId = interaction.customId.slice(SELF_ROLE_PREFIX.length);
  const role: Role | undefined = guild.roles.cache.get(roleId);
  if (!role) {
    await interaction.reply({ content: "That role no longer exists.", ephemeral: true });
    return;
  }
  // Re-checked on every press: the role's permissions may have changed since the panel was posted.
  const problem = selfRoleProblem({ id: role.id, managed: role.managed, permissions: role.permissions.bitfield }, guild.id);
  if (problem) {
    await interaction.reply({ content: problem, ephemeral: true });
    return;
  }
  if ((guild.members.me?.roles.highest.position ?? 0) <= role.position) {
    await interaction.reply({ content: "I cannot assign that role - it is above my own role. Ask an officer to move my role higher.", ephemeral: true });
    return;
  }
  const member = interaction.member as GuildMember;
  if (member.roles.cache.has(role.id)) {
    await member.roles.remove(role.id);
    await interaction.reply({ content: `Removed **${role.name}**.`, ephemeral: true });
  } else {
    await member.roles.add(role.id);
    await interaction.reply({ content: `Added **${role.name}**.`, ephemeral: true });
  }
}
