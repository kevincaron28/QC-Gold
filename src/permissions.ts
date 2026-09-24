import type { GuildMember } from "discord.js";

export const permissionRoles = {
  guildMaster: "Guild Master",
  officer: "Officer",
  raidLeader: "Raid Leader",
  dkpOfficer: "DKP Officer",
  lootLeader: "Loot Leader",
  classLeader: "Class Leader"
} as const;

export type Permission = keyof typeof permissionRoles;

const inheritedPermissions: Record<Permission, readonly Permission[]> = {
  guildMaster: ["guildMaster"],
  officer: ["officer", "guildMaster"],
  raidLeader: ["raidLeader", "officer", "guildMaster"],
  dkpOfficer: ["dkpOfficer", "officer", "guildMaster"],
  lootLeader: ["lootLeader", "officer", "guildMaster"],
  classLeader: ["classLeader", "officer", "guildMaster"]
};

export function hasPermission(member: GuildMember, permission: Permission): boolean {
  if (member.permissions.has("Administrator")) return true;
  return inheritedPermissions[permission].some((role) =>
    member.roles.cache.some((guildRole) => guildRole.name === permissionRoles[role])
  );
}
