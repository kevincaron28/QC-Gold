import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction, type GuildMember } from "discord.js";
import { asLang, t, type Lang } from "../i18n.js";
import { hasPermission } from "../permissions.js";
import { guildService } from "./context.js";

// Short, rank-aware command list in the guild's language: everyone sees the
// member section; officers and leaders also see what they're allowed to run.
export const helpCommand = new SlashCommandBuilder()
  .setName("help")
  .setDescription("What can I do here? Lists the commands you can use.");

const LINES: Record<"everyone" | "raidLeader" | "dkpOfficer" | "officer", Record<Lang, string[]>> = {
  everyone: {
    en: [
      "`/character add` — link your WoW character (do this first)",
      "Raid posts have buttons to sign up (or use `/raid signup`)",
      "`/epgp balance` · `/epgp leaderboard` · `/profile` · `/who <name>`",
      "`/raid progress` · `/raid report` · `/stats` · `/loot history`",
      "`/loot bid` — bid GP on a Discord loot auction",
      "`/wishlist add` · `/profession set` · `/profession who <prof>`",
      "`/bank request` — ask the guild bank · `/craft request` — ask a crafter",
      "`/dungeon leaderboard` · `/dungeon records` · `/dungeon player` — dungeon challenge",
      "`/readiness me` — your latest gear check from the addon",
      "`/apply` — apply to the guild"
    ],
    fr: [
      "`/character add` — liez votre personnage WoW (à faire en premier)",
      "Les annonces de raid ont des boutons pour s'inscrire (ou `/raid signup`)",
      "`/epgp balance` · `/epgp leaderboard` · `/profile` · `/who <nom>`",
      "`/raid progress` · `/raid report` · `/stats` · `/loot history`",
      "`/loot bid` — miser des GP sur une enchère Discord",
      "`/wishlist add` · `/profession set` · `/profession who <métier>`",
      "`/bank request` — demander à la banque de guilde · `/craft request` — demander à un artisan",
      "`/dungeon leaderboard` · `/dungeon records` · `/dungeon player` — défi des donjons",
      "`/readiness me` — votre dernière vérification d'équipement (addon)",
      "`/apply` — postuler à la guilde"
    ]
  },
  raidLeader: {
    en: [
      "`/raid create` (times like `friday 8pm`) · `/raid edit` · `/raid start` · `/raid end` (shows the EP to approve)",
      "`/raid attendance` · `/raid boss` · `/raid note` · `/raid award-ep`",
      "`/readiness raid` — who's ready for tonight"
    ],
    fr: [
      "`/raid create` (heures comme `vendredi 20h`) · `/raid edit` · `/raid start` · `/raid end` (propose les EP à approuver)",
      "`/raid attendance` · `/raid boss` · `/raid note` · `/raid award-ep`",
      "`/readiness raid` — qui est prêt pour ce soir"
    ]
  },
  dkpOfficer: {
    en: ["`/epgp award-ep` · `/epgp award-gp` · `/epgp reverse` · `/epgp decay`", "`/epgp history player:` — anyone's history"],
    fr: ["`/epgp award-ep` · `/epgp award-gp` · `/epgp reverse` · `/epgp decay`", "`/epgp history player:` — l'historique de n'importe qui"]
  },
  officer: {
    en: [
      "`/setup` — guided setup and checklist · `/config` — every setting",
      "`/loot auction` · `/loot close` · `/import-apply` (addon data)",
      "`/testraid start` — fake raid to try everything, `/testraid cleanup` after",
      "`/dungeon-admin` — invalidate a run, award points, rules, target times, new season",
      "`/bank list` / `handle` · `/application list` · `/mod` · `/tag set` · `/selfroles`"
    ],
    fr: [
      "`/setup` — configuration guidée et liste de vérification · `/config` — tous les réglages",
      "`/loot auction` · `/loot close` · `/import-apply` (données de l'addon)",
      "`/testraid start` — faux raid pour tout essayer, puis `/testraid cleanup`",
      "`/dungeon-admin` — annuler un donjon, donner des points, règles, temps cibles, nouvelle saison",
      "`/bank list` / `handle` · `/application list` · `/mod` · `/tag set` · `/selfroles`"
    ]
  }
};

export async function executeHelp(interaction: ChatInputCommandInteraction): Promise<void> {
  let lang: Lang = "en";
  if (interaction.guildId && interaction.guild) {
    const guild = await guildService.ensureGuild(interaction.guildId, interaction.guild.name);
    lang = asLang((await guildService.getSettings(guild.id))?.language);
  }
  const member = interaction.member as GuildMember | null;
  const can = (permission: Parameters<typeof hasPermission>[1]) => !!member && hasPermission(member, permission);
  const embed = new EmbedBuilder().setTitle(t(lang, "help.title")).setColor(0xd4af37)
    .addFields({ name: t(lang, "help.everyone"), value: LINES.everyone[lang].join("\n") });
  if (can("raidLeader")) embed.addFields({ name: t(lang, "help.raidLeaders"), value: LINES.raidLeader[lang].join("\n") });
  if (can("dkpOfficer")) embed.addFields({ name: t(lang, "help.epgpOfficers"), value: LINES.dkpOfficer[lang].join("\n") });
  if (can("officer")) embed.addFields({ name: t(lang, "help.officers"), value: LINES.officer[lang].join("\n") });
  embed.setFooter({ text: t(lang, "help.footer") });
  await interaction.reply({ embeds: [embed], ephemeral: true });
}
