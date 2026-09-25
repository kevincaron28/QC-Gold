import { SlashCommandBuilder, type ChatInputCommandInteraction, type GuildMember } from "discord.js";
import { prisma } from "../database.js";
import { hasPermission } from "../permissions.js";
import { cleanupTestRaids, finishTestRaid, SIM_CHARACTERS, startTestRaid } from "../services/simulation.js";
import { requireGuildContext } from "./context.js";
import { showEpProposal } from "./ep-award.js";
import { syncSignupEmbed } from "./raid.js";

export const testRaidCommand = new SlashCommandBuilder()
  .setName("testraid")
  .setDescription("Fake raid for testing (officers). Test data is separate and removable.")
  .addSubcommand((sub) => sub.setName("start").setDescription("Create a [TEST] raid with fake raiders signed up (caps, Maybe, waitlist).")
    .addIntegerOption((o) => o.setName("raiders").setDescription(`How many fake raiders (6-${SIM_CHARACTERS.length}, default 10)`).setMinValue(6).setMaxValue(SIM_CHARACTERS.length))
    .addIntegerOption((o) => o.setName("starts_in").setDescription("Minutes until it starts (default 70, so the reminder fires)").setMinValue(2).setMaxValue(1440))
    .addStringOption((o) => o.setName("realm").setDescription("Realm for the fake characters (default: your main's realm)")))
  .addSubcommand((sub) => sub.setName("finish").setDescription("Play the test raid: attendance, boss kills, loot, then end it and propose EP.")
    .addStringOption((o) => o.setName("raid").setDescription("Test raid ID").setRequired(true))
    .addBooleanOption((o) => o.setName("via_addon").setDescription("Send attendance as an addon import to /import-apply instead")))
  .addSubcommand((sub) => sub.setName("cleanup").setDescription("Delete every test raid, fake raider, and their EPGP/loot."));

async function defaultRealm(memberId: string): Promise<string> {
  const main = await prisma.character.findFirst({ where: { memberId }, orderBy: { isMain: "desc" }, select: { realm: true } });
  return main?.realm ?? "WoW Forever";
}

export async function executeTestRaid(interaction: ChatInputCommandInteraction): Promise<void> {
  const context = await requireGuildContext(interaction);
  if (!context) return;
  if (!interaction.member || !hasPermission(interaction.member as GuildMember, "officer")) {
    await interaction.reply({ content: "Only officers can run test raids.", ephemeral: true });
    return;
  }
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "cleanup") {
    const removed = await cleanupTestRaids(prisma, context.guildId);
    await interaction.reply({
      content: `Removed ${removed.raids} test raid(s), ${removed.members} fake raider(s) with their EPGP and loot, ${removed.auctions} test auction(s), and ${removed.imports} simulated import(s). Real data was not touched. (Delete any old test signup embeds by hand.)`,
      ephemeral: true
    });
    return;
  }

  const realm = interaction.options.getString("realm") ?? await defaultRealm(context.memberId);

  if (subcommand === "start") {
    const result = await startTestRaid(prisma, {
      guildId: context.guildId,
      createdBy: interaction.user.id,
      officerMemberId: context.memberId,
      realm,
      raiders: interaction.options.getInteger("raiders") ?? 10,
      startsInMinutes: interaction.options.getInteger("starts_in") ?? 70
    });
    if (interaction.guild) await syncSignupEmbed(interaction.guild, context.guildId, result.raid.id);
    await interaction.reply({
      content: [
        `Created **${result.raid.title}** \`${result.raid.id}\` with ${result.members} fake raiders (realm ${realm}):`,
        `${result.counts.SIGNED_UP} signed up, ${result.counts.MAYBE} maybe, ${result.counts.WAITLISTED} waitlisted.`,
        "Try it: `/raid signup` yourself, `/raid cancel-signup`, `/raid edit` caps (waitlist moves up), `/raid roster`, `/raid note`.",
        "The raid reminder fires 60 minutes before start (if a signup channel is set).",
        `When ready: \`/testraid finish raid:${result.raid.id}\` (add \`via_addon:true\` to test the import path). Clean up with \`/testraid cleanup\`.`,
        `In game, \`/qg sim\` uses the same fake names (${SIM_CHARACTERS.slice(0, 3).join(", ")}...) so an addon export matches.`
      ].join("\n"),
      ephemeral: true
    });
    return;
  }

  const viaAddon = interaction.options.getBoolean("via_addon") ?? false;
  const result = await finishTestRaid(prisma, {
    guildId: context.guildId,
    raidId: interaction.options.getString("raid", true).trim(),
    officerId: interaction.user.id,
    realm,
    viaAddon
  });
  if (interaction.guild) await syncSignupEmbed(interaction.guild, context.guildId, result.raid.id);
  const summary = [
    `Played **${result.raid.title}**: all bosses killed, ${result.attending} raiders there` +
      `${result.late ? `, ${result.late} late` : ""}${result.noShow ? `, ${result.noShow} no-show` : ""}${result.walkIn ? `, ${result.walkIn} walked in from the waitlist` : ""}.`,
    result.loot.length ? `Loot: ${result.loot.map((row) => `${row.item} → ${row.winner} (${row.gp} GP)`).join(", ")}.` : "No loot awarded."
  ].join("\n");
  if (result.importId) {
    await interaction.reply({
      content: `${summary}\nAttendance was sent as an addon import. Apply it with \`/import-apply id:${result.importId}\` (you should see the no-show and the walk-in), then \`/raid award-ep raid:${result.raid.id}\`.`,
      ephemeral: true
    });
    return;
  }
  await showEpProposal(interaction, context.guildId, result.raid.id, `${summary}\nApprove to test EP awards and the raid report:`);
}
