import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { createLootService } from "../services/loot.js";
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
    .addIntegerOption((o) => o.setName("duration").setDescription("Duration in seconds").setMinValue(1).setMaxValue(86400).setRequired(true)))
  .addSubcommand((sub) => sub.setName("bid").setDescription("Bid on an active auction.")
    .addStringOption((o) => o.setName("auction").setDescription("Auction ID").setRequired(true))
    .addIntegerOption((o) => o.setName("amount").setDescription("Bid amount").setMinValue(1).setRequired(true)))
  .addSubcommand((sub) => sub.setName("close").setDescription("Close an auction.")
    .addStringOption((o) => o.setName("auction").setDescription("Auction ID").setRequired(true)))
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
      createdBy: interaction.user.id
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
    return;
  }
  const history = await lootService.getHistory(context.guildId);
  await interaction.reply(history.length
    ? history.map((award) => `**${award.itemName}** — ${award.amount} GP — <@${award.member.discordUserId}>`).join("\n")
    : "No loot has been awarded yet.");
}
