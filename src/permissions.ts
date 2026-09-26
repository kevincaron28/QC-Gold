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

// A French guild (setup language) gets French role names. Both spellings work everywhere, so a
// server can be switched or mixed without anyone losing access.
export const permissionRolesFr = {
  guildMaster: "Maître de guilde",
  officer: "Officier",
  raidLeader: "Chef de raid",
  dkpOfficer: "Officier DKP",
  lootLeader: "Chef du butin",
  classLeader: "Chef de classe"
} as const;

export const permissionRoleNames = (permission: Permission): string[] => [permissionRoles[permission], permissionRolesFr[permission]];
export const roleNamesFor = (lang: "en" | "fr") => (lang === "fr" ? permissionRolesFr : permissionRoles);
// True when a Discord role name is one of the names for the permission (either language).
export const isPermissionRoleName = (permission: Permission, name: string): boolean => permissionRoleNames(permission).includes(name);

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
    member.roles.cache.some((guildRole) => isPermissionRoleName(role, guildRole.name))
  );
}
