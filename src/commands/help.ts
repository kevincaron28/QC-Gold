import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction, type GuildMember } from "discord.js";
import { hasPermission } from "../permissions.js";

// Short, rank-aware command list: everyone sees the member section; officers
// and leaders also see what they're allowed to run.
export const helpCommand = new SlashCommandBuilder()
  .setName("help")
  .setDescription("What can I do here? Lists the commands you can use.");

const EVERYONE = [
  "`/character add` — link your WoW character (do this first)",
  "`/raid signup` / `/raid cancel-signup` — join or leave a raid (Available or Maybe)",
  "`/epgp balance` · `/epgp leaderboard` · `/profile` · `/who <name>`",
  "`/raid progress` · `/raid report` · `/stats` · `/loot history`",
  "`/loot bid` — bid GP on a Discord loot auction",
  "`/wishlist add` · `/profession set` · `/profession who <prof>`",
  "`/bank request` — ask the guild bank · `/craft request` — ask a crafter",
  "`/readiness me` — your latest gear check from the addon",
  "`/apply` — apply to the guild"
];

const RAID_LEADER = [
  "`/raid create` · `/raid edit` · `/raid start` · `/raid end` (shows the EP to approve)",
  "`/raid attendance` · `/raid boss` · `/raid note` · `/raid award-ep`",
  "`/readiness raid` — who's ready for tonight"
];

const DKP_OFFICER = [
  "`/epgp award-ep` · `/epgp award-gp` · `/epgp reverse` · `/epgp decay`",
  "`/epgp history player:` — anyone's history with entry IDs"
];

const OFFICER = [
  "`/setup` — guided setup and checklist · `/config` — every setting",
  "`/loot auction` · `/loot close` · `/import-apply` (addon data)",
  "`/testraid start` — fake raid to try everything, `/testraid cleanup` after",
  "`/bank list` / `handle` · `/application list` · `/mod` · `/tag set` · `/selfroles`"
];

export async function executeHelp(interaction: ChatInputCommandInteraction): Promise<void> {
  const member = interaction.member as GuildMember | null;
  const can = (permission: Parameters<typeof hasPermission>[1]) => !!member && hasPermission(member, permission);
  const embed = new EmbedBuilder().setTitle("⚜️ Quebec Gold — commands").setColor(0xd4af37)
    .addFields({ name: "Everyone", value: EVERYONE.join("\n") });
  if (can("raidLeader")) embed.addFields({ name: "Raid Leaders", value: RAID_LEADER.join("\n") });
  if (can("dkpOfficer")) embed.addFields({ name: "EPGP Officers", value: DKP_OFFICER.join("\n") });
  if (can("officer")) embed.addFields({ name: "Officers", value: OFFICER.join("\n") });
  embed.setFooter({ text: "In game: click the gold coin on the minimap, or type /qg help." });
  await interaction.reply({ embeds: [embed], ephemeral: true });
}
