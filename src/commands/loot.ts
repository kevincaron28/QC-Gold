import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { createLootService } from "../services/loot.js";
import { notifications, notify } from "../services/notify.js";
import { createWishlistService } from "../services/wishlist.js";
import { prisma } from "../database.js";
import { hasPermission } from "../permissions.js";
import { requireGuildContext } from "./context.js";

const lootService = createLootService(prisma);
const wishlistService = createWishlistService(prisma);

export const lootCommand = new SlashCommandBuilder()
  .setName("loot").setDescription("Auction and track raid loot.")
  .addSubcommand((sub) => sub.setName("auction").setDescription("Start a loot auction.")
    .addStringOption((o) => o.setName("item").setDescription("Item name").setRequired(true))
    .addIntegerOption((o) => o.setName("minimum").setDescription("Minimum bid").setMinValue(1).setRequired(true))
    .addIntegerOption((o) => o.setName("increment").setDescription("Bid increment").setMinValue(1).setRequired(true))
    .addIntegerOption((o) => o.setName("duration").setDescription("Duration in seconds").setMinValue(1).setMaxValue(86400).setRequired(true))
    .addStringOption((o) => o.setName("boss").setDescription("Boss that dropped it (for loot history)"))
    .addStringOption((o) => o.setName("raid").setDescription("Raid for loot history (start typing its name)").setAutocomplete(true)))
  .addSubcommand((sub) => sub.setName("bid").setDescription("Bid on an active auction.")
    .addStringOption((o) => o.setName("auction").setDescription("Auction (start typing the item)").setAutocomplete(true).setRequired(true))
    .addIntegerOption((o) => o.setName("amount").setDescription("Bid amount").setMinValue(1).setRequired(true)))
  .addSubcommand((sub) => sub.setName("close").setDescription("Close an auction.")
    .addStringOption((o) => o.setName("auction").setDescription("Auction (start typing the item)").setAutocomplete(true).setRequired(true)))
  .addSubcommand((sub) => sub.setName("history").setDescription("View awarded loot."));

function officer(interaction: ChatInputCommandInteraction): boolean {
  return !!interaction.member && hasPermission(interaction.member as Parameters<typeof hasPermission>[0], "officer");
}

export async function executeLoot(interaction: ChatInputCommandInteraction): Promise<void> {
  const context = await requireGuildContext(interaction);
  if (!context) return;
  const subcommand = interaction.options.getSubcommand();
  if ((subcommand === "auction" || subcommand === "close") && !officer(interaction)) {
    await interaction.reply({ content: "Only officers, Guild Masters, or administrators can manage auctions.", ephemeral: true });
    return;
  }
  if (subcommand === "auction") {
    const auction = await lootService.createAuction({
      guildId: context.guildId,
      itemName: interaction.options.getString("item", true),
      minimumBid: interaction.options.getInteger("minimum", true),
      bidIncrement: interaction.options.getInteger("increment", true),
      durationSeconds: interaction.options.getInteger("duration", true),
      createdBy: interaction.user.id,
      bossName: interaction.options.getString("boss") ?? undefined,
      raidId: interaction.options.getString("raid") ?? undefined
    });
    const wanting = await wishlistService.countWanting(context.guildId, auction.itemName);
    await interaction.reply(`Auction **${auction.itemName}** started. ID: \`${auction.id}\`; closes <t:${Math.floor(auction.closesAt.getTime() / 1000)}:R>.${wanting > 0 ? ` Wishlisted by ${wanting} raider(s).` : ""}`);
    return;
  }
  if (subcommand === "bid") {
    const bid = await lootService.placeBid({
      auctionId: interaction.options.getString("auction", true),
      memberId: context.memberId,
      amount: interaction.options.getInteger("amount", true)
    });
    await interaction.reply({ content: `Bid of **${bid.amount} GP** placed.`, ephemeral: true });
    return;
  }
  if (subcommand === "close") {
    const result = await lootService.closeAuction(interaction.options.getString("auction", true), interaction.user.id);
    await interaction.reply(result.award
      ? `Auction closed. **${result.award.itemName}** awarded for **${result.award.amount} GP**.`
      : "Auction closed with no bids.");
    if (result.award) {
      await notify(interaction.guild, notifications.lootAwarded(result.award.itemName, result.award.member.displayName, result.award.amount), "loot");
    }
    return;
  }
  const history = await lootService.getHistory(context.guildId);
  const raidIds = [...new Set(history.map((award) => award.raidId).filter((id): id is string => !!id))];
  const raids = new Map((await prisma.raid.findMany({ where: { id: { in: raidIds } }, select: { id: true, title: true } }))
    .map((raid) => [raid.id, raid.title]));
  // One line per award: item, boss/raid, winner, GP, their GP before -> after,
  // who awarded it, and when.
  const lines = history.map((award) => {
    const where = [award.bossName, award.raidId ? raids.get(award.raidId) : null].filter(Boolean).join(", ");
    const gpChange = award.gpBefore === null ? "" : ` (GP ${award.gpBefore} → ${award.gpBefore + award.amount})`;
    const by = award.awardedBy ? `, by <@${award.awardedBy}>` : "";
    return `**${award.itemName}**${where ? ` [${where}]` : ""} — <@${award.member.discordUserId}> ${award.amount} GP${gpChange}${by} <t:${Math.floor(award.awardedAt.getTime() / 1000)}:d>`;
  });
  let text = "";
  for (const line of lines) {
    if (text.length + line.length > 1900) break;
    text += `${line}\n`;
  }
  await interaction.reply({ content: text || "No loot has been awarded yet.", allowedMentions: { parse: [] } });
}
