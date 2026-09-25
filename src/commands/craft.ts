import { SlashCommandBuilder, type ChatInputCommandInteraction, type GuildMember } from "discord.js";
import { prisma } from "../database.js";
import { hasPermission } from "../permissions.js";
import { createCraftService } from "../services/craft.js";
import { postToLogChannel } from "../services/housekeeping.js";
import { findProfessionHolders } from "../services/profession-search.js";
import { requireGuildContext } from "./context.js";

const craftService = createCraftService(prisma);

const idOption = (name: string) => (o: import("discord.js").SlashCommandStringOption) =>
  o.setName("id").setDescription(`Request ID (${name})`).setRequired(true);

export const craftCommand = new SlashCommandBuilder()
  .setName("craft")
  .setDescription("Ask guild crafters to make something, or pick up requests.")
  .addSubcommand((sub) => sub.setName("request").setDescription("Ask a guild crafter to make an item.")
    .addStringOption((o) => o.setName("item").setDescription("Item to craft").setMaxLength(100).setRequired(true))
    .addStringOption((o) => o.setName("profession").setDescription("Profession, e.g. Alchemy (shows who can make it)").setMaxLength(40))
    .addIntegerOption((o) => o.setName("quantity").setDescription("How many (default 1)").setMinValue(1).setMaxValue(200))
    .addBooleanOption((o) => o.setName("materials").setDescription("You will provide the materials"))
    .addStringOption((o) => o.setName("note").setDescription("Details, tip, deadline").setMaxLength(300)))
  .addSubcommand((sub) => sub.setName("list").setDescription("Open requests crafters can pick up.")
    .addStringOption((o) => o.setName("profession").setDescription("Only this profession")))
  .addSubcommand((sub) => sub.setName("mine").setDescription("Your open requests and the ones you're crafting."))
  .addSubcommand((sub) => sub.setName("claim").setDescription("Take a request (you'll craft it).").addStringOption(idOption("from /craft list")))
  .addSubcommand((sub) => sub.setName("done").setDescription("Mark a request you claimed as crafted.").addStringOption(idOption("from /craft mine")))
  .addSubcommand((sub) => sub.setName("release").setDescription("Give a claimed request back to the list.").addStringOption(idOption("from /craft mine")))
  .addSubcommand((sub) => sub.setName("cancel").setDescription("Cancel your request.").addStringOption(idOption("from /craft mine")));

function describe(request: { item: string; quantity: number; profession: string | null; materialsProvided: boolean; note: string | null }): string {
  return `${request.quantity} × **${request.item}**${request.profession ? ` (${request.profession})` : ""}`
    + `${request.materialsProvided ? ", mats provided" : ""}${request.note ? ` — ${request.note}` : ""}`;
}

export async function executeCraft(interaction: ChatInputCommandInteraction): Promise<void> {
  const context = await requireGuildContext(interaction);
  if (!context) return;
  const subcommand = interaction.options.getSubcommand();
  const isOfficer = !!interaction.member && hasPermission(interaction.member as GuildMember, "officer");
  const dm = (userId: string, text: string) => interaction.client.users.send(userId, text).catch(() => undefined);

  if (subcommand === "request") {
    const profession = interaction.options.getString("profession") ?? undefined;
    const request = await craftService.request({
      guildId: context.guildId,
      requesterId: context.memberId,
      item: interaction.options.getString("item", true),
      profession,
      quantity: interaction.options.getInteger("quantity") ?? 1,
      note: interaction.options.getString("note") ?? undefined,
      materialsProvided: interaction.options.getBoolean("materials") ?? false
    });
    const crafters = profession ? (await findProfessionHolders(prisma, context.guildId, profession)).slice(0, 5) : [];
    await interaction.reply({
      content: `Request posted: ${describe(request)}. ID \`${request.id}\`. You'll get a DM when someone claims it.`
        + (crafters.length ? `\nGuild ${profession} crafters: ${crafters.map((c) => `${c.character} (${c.skillLevel})`).join(", ")}` : ""),
      ephemeral: true
    });
    if (interaction.guild) {
      await postToLogChannel(interaction.guild, `🔨 Craft request from ${interaction.user.username}: ${describe(request)} — /craft claim id:${request.id}`);
    }
    return;
  }
  if (subcommand === "list") {
    const requests = await craftService.list(context.guildId, interaction.options.getString("profession") ?? undefined);
    const text = requests.map((r) => `• ${describe(r)} for ${r.requester.displayName} <t:${Math.floor(r.createdAt.getTime() / 1000)}:R> \`${r.id}\``).join("\n");
    await interaction.reply({ content: text.slice(0, 1900) || "No open craft requests.", ephemeral: true });
    return;
  }
  if (subcommand === "mine") {
    const requests = await craftService.mine(context.guildId, context.memberId);
    const text = requests.map((r) => r.requesterId === context.memberId
      ? `📝 ${describe(r)} — ${r.status === "CLAIMED" ? `being crafted by ${r.crafter?.displayName}` : "waiting for a crafter"} \`${r.id}\``
      : `🔨 ${describe(r)} for ${r.requester.displayName} (you claimed it) \`${r.id}\``).join("\n");
    await interaction.reply({ content: text.slice(0, 1900) || "Nothing open.", ephemeral: true });
    return;
  }

  const id = interaction.options.getString("id", true).replace(/`/g, "").trim();
  if (subcommand === "claim") {
    const request = await craftService.claim(context.guildId, id, context.memberId);
    await interaction.reply({ content: `You claimed ${describe(request)} for ${request.requester.displayName}. \`/craft done id:${request.id}\` when it's made.`, ephemeral: true });
    await dm(request.requester.discordUserId, `🔨 ${request.crafter?.displayName ?? "A guild crafter"} is crafting your ${describe(request)}.`);
    return;
  }
  if (subcommand === "done") {
    const request = await craftService.complete(context.guildId, id, context.memberId, isOfficer);
    await interaction.reply({ content: `Marked done: ${describe(request)}.`, ephemeral: true });
    await dm(request.requester.discordUserId, `✅ Your ${describe(request)} is crafted by ${request.crafter?.displayName ?? "a guild crafter"}. Check your mail or arrange a trade.`);
    return;
  }
  if (subcommand === "release") {
    const request = await craftService.release(context.guildId, id, context.memberId, isOfficer);
    await interaction.reply({ content: `Released ${describe(request)} back to the list.`, ephemeral: true });
    return;
  }
  const request = await craftService.cancel(context.guildId, id, context.memberId, isOfficer);
  await interaction.reply({ content: `Cancelled ${describe(request)}.`, ephemeral: true });
  if (request.crafter) await dm(request.crafter.discordUserId, `The craft request for ${describe(request)} was cancelled.`);
}
