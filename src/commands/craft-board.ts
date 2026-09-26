import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  type ButtonInteraction, type ForumChannel, type Guild as DiscordGuild, type GuildMember, type ModalSubmitInteraction, type ThreadChannel
} from "discord.js";
import type { CraftRequestStatus } from "@prisma/client";
import { prisma } from "../database.js";
import { hasPermission } from "../permissions.js";
import { createCraftService } from "../services/craft.js";
import { findProfessionHolders } from "../services/profession-search.js";
import { PROFESSIONS } from "../wow-data.js";
import { guildService } from "./context.js";

// The craft board: a forum channel where every craft request is its own post
// with tags (profession and Open / Claimed / Done) and buttons inside the post
// (Claim, Mark done, Give back, Cancel). Members ask for a craft with the
// "Request a craft" button on the pinned guide post (a small form) or with
// /craft request; crafters filter the forum by profession tag and click. If
// the craft channel is an ordinary text channel, the old behaviour is used.

const craftService = createCraftService(prisma);
export const CRAFT_PREFIX = "craft:";

const STATUS_LABEL: Record<CraftRequestStatus, string> = { OPEN: "🟢 Open", CLAIMED: "🟡 Claimed", DONE: "✅ Done", CANCELLED: "⛔ Cancelled" };
const STATUS_COLOR: Record<CraftRequestStatus, number> = { OPEN: 0x57f287, CLAIMED: 0xfee75c, DONE: 0x808080, CANCELLED: 0x808080 };

export const boardTagNames = (): string[] => [...Object.values(STATUS_LABEL), ...PROFESSIONS.slice(0, 16)];

type RequestRow = {
  id: string; item: string; quantity: number; profession: string | null; note: string | null; materialsProvided: boolean;
  status: CraftRequestStatus; createdAt: Date;
  requester: { discordUserId: string; displayName: string }; crafter: { discordUserId: string; displayName: string } | null;
};

export function threadTitle(request: Pick<RequestRow, "status" | "quantity" | "item">): string {
  return `${STATUS_LABEL[request.status].split(" ")[0]} ${request.quantity}× ${request.item}`.slice(0, 100);
}

export function craftEmbed(request: RequestRow, crafters: string[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(STATUS_COLOR[request.status])
    .setTitle(`🔨 ${request.quantity}× ${request.item}`.slice(0, 250))
    .addFields(
      { name: "Status", value: STATUS_LABEL[request.status], inline: true },
      { name: "Asked by", value: `<@${request.requester.discordUserId}>`, inline: true },
      { name: "Crafter", value: request.crafter ? `<@${request.crafter.discordUserId}>` : "nobody yet", inline: true }
    )
    .setFooter({ text: `Request ${request.id}` });
  if (request.profession) embed.addFields({ name: "Profession", value: request.profession, inline: true });
  embed.addFields({ name: "Materials", value: request.materialsProvided ? "Requester provides them" : "Crafter's or to be arranged", inline: true });
  if (request.note) embed.setDescription(request.note.slice(0, 1000));
  if (crafters.length && (request.status === "OPEN" || request.status === "CLAIMED")) embed.addFields({ name: `Guild ${request.profession} crafters`, value: crafters.join(", ").slice(0, 1000) });
  embed.setTimestamp(request.createdAt);
  return embed;
}

function buttonsFor(request: Pick<RequestRow, "id" | "status">) {
  if (request.status === "DONE" || request.status === "CANCELLED") return [];
  const b = (action: string, label: string, style: ButtonStyle) => new ButtonBuilder().setCustomId(`${CRAFT_PREFIX}${request.id}:${action}`).setLabel(label).setStyle(style);
  return [new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...(request.status === "OPEN"
      ? [b("claim", "I'll craft it", ButtonStyle.Success)]
      : [b("done", "Mark done", ButtonStyle.Success), b("release", "Give back", ButtonStyle.Secondary)]),
    b("cancel", "Cancel request", ButtonStyle.Danger)
  )];
}

// ---------------------------------------------------------------------
// The forum
// ---------------------------------------------------------------------

async function boardForum(discordGuild: DiscordGuild, guildId: string): Promise<ForumChannel | null> {
  const settings = await guildService.getSettings(guildId);
  if (!settings?.craftChannelId) return null;
  const channel = await discordGuild.channels.fetch(settings.craftChannelId).catch(() => null);
  return channel?.type === ChannelType.GuildForum ? channel : null;
}

// Makes sure the forum has the status and profession tags (keeps any others).
export async function ensureBoardTags(forum: ForumChannel): Promise<void> {
  const wanted = boardTagNames();
  const have = new Set(forum.availableTags.map((tag) => tag.name));
  const missing = wanted.filter((name) => !have.has(name));
  if (missing.length === 0) return;
  const room = 20 - forum.availableTags.length;
  await forum.setAvailableTags([...forum.availableTags, ...missing.slice(0, Math.max(0, room)).map((name) => ({ name }))]);
}

function tagIds(forum: ForumChannel, status: CraftRequestStatus, profession: string | null): string[] {
  const byName = new Map(forum.availableTags.map((tag) => [tag.name, tag.id]));
  return [byName.get(STATUS_LABEL[status]), profession ? byName.get(profession) : undefined].filter((id): id is string => !!id);
}

export const GUIDE_TEXT = [
  "**How the craft board works**",
  "• Press **Request a craft** below (or use `/craft request`): fill in the item. It becomes its own post here.",
  "• Crafters: filter this forum by your profession tag, open a post and press **I'll craft it**. Press **Mark done** when it's made.",
  "• The post title and tag follow the status: 🟢 Open, 🟡 Claimed, ✅ Done. Finished posts lock.",
  "• Anyone can cancel their own request; officers can cancel or finish any."
].join("\n");

// Posts the pinned guide (with the "Request a craft" button) in a forum. Run once by /setup.
export async function postBoardGuide(forum: ForumChannel): Promise<void> {
  await ensureBoardTags(forum);
  const thread = await forum.threads.create({
    name: "📌 Start here: how the craft board works",
    message: {
      content: GUIDE_TEXT,
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`${CRAFT_PREFIX}new`).setLabel("Request a craft").setStyle(ButtonStyle.Primary))]
    }
  });
  await thread.pin().catch(() => undefined);
}

async function openThread(forum: ForumChannel, threadId: string): Promise<ThreadChannel | null> {
  const thread = await forum.threads.fetch(threadId).catch(() => null);
  if (!thread) return null;
  if (thread.archived) await thread.setArchived(false).catch(() => undefined);
  if (thread.locked) await thread.setLocked(false).catch(() => undefined);
  return thread;
}

async function loadRequest(requestId: string): Promise<RequestRow & { threadId: string | null; guildId: string }> {
  return prisma.craftRequest.findUniqueOrThrow({ where: { id: requestId }, include: { requester: true, crafter: true } });
}

// Creates the forum post for a new request. False when the craft channel is not a forum.
export async function postCraftRequest(discordGuild: DiscordGuild | null, requestId: string): Promise<{ posted: boolean; threadId?: string }> {
  if (!discordGuild) return { posted: false };
  try {
    const request = await loadRequest(requestId);
    const forum = await boardForum(discordGuild, request.guildId);
    if (!forum) return { posted: false };
    await ensureBoardTags(forum);
    const crafters = request.profession ? (await findProfessionHolders(prisma, request.guildId, request.profession)).slice(0, 5).map((c) => `${c.character} (${c.skillLevel})`) : [];
    const thread = await forum.threads.create({
      name: threadTitle(request),
      message: { embeds: [craftEmbed(request, crafters)], components: buttonsFor(request), allowedMentions: { parse: [] } },
      appliedTags: tagIds(forum, request.status, request.profession)
    });
    await prisma.craftRequest.update({ where: { id: request.id }, data: { threadId: thread.id } });
    return { posted: true, threadId: thread.id };
  } catch (error) {
    console.error("Failed to post the craft request to the board", error);
    return { posted: false };
  }
}

// Brings the forum post in line with the request: title, tags, embed, buttons; locks it when finished.
export async function syncCraftPost(discordGuild: DiscordGuild | null, requestId: string): Promise<void> {
  if (!discordGuild) return;
  try {
    const request = await loadRequest(requestId);
    if (!request.threadId) return;
    const forum = await boardForum(discordGuild, request.guildId);
    if (!forum) return;
    const thread = await openThread(forum, request.threadId);
    if (!thread) return;
    const crafters = request.profession ? (await findProfessionHolders(prisma, request.guildId, request.profession)).slice(0, 5).map((c) => `${c.character} (${c.skillLevel})`) : [];
    const starter = await thread.fetchStarterMessage().catch(() => null);
    await starter?.edit({ embeds: [craftEmbed(request, crafters)], components: buttonsFor(request), allowedMentions: { parse: [] } });
    await thread.setName(threadTitle(request)).catch(() => undefined);
    await thread.setAppliedTags(tagIds(forum, request.status, request.profession)).catch(() => undefined);
    if (request.status === "DONE" || request.status === "CANCELLED") {
      await thread.send({ content: request.status === "DONE" ? `✅ Crafted by <@${request.crafter?.discordUserId ?? request.requester.discordUserId}>. Closing this post.` : "⛔ Cancelled. Closing this post.", allowedMentions: { parse: [] } }).catch(() => undefined);
      await thread.setLocked(true).catch(() => undefined);
      await thread.setArchived(true).catch(() => undefined);
    }
  } catch (error) {
    console.error("Failed to update the craft board post", error);
  }
}

// ---------------------------------------------------------------------
// Buttons and the request form
// ---------------------------------------------------------------------

export async function handleCraftButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild) return;
  const rest = interaction.customId.slice(CRAFT_PREFIX.length);
  if (rest === "new") {
    await interaction.showModal(requestModal());
    return;
  }
  const [requestId, action] = rest.split(":");
  if (!requestId || !action) return;
  await interaction.deferReply({ ephemeral: true });
  const guild = await guildService.ensureGuild(interaction.guild.id, interaction.guild.name);
  const member = await guildService.ensureMember(guild.id, interaction.user.id, (interaction.member as GuildMember | null)?.displayName ?? interaction.user.username);
  const isOfficer = !!interaction.member && hasPermission(interaction.member as GuildMember, "officer");
  const dm = (userId: string, text: string) => interaction.client.users.send(userId, text).catch(() => undefined);
  try {
    const summary = (r: { quantity: number; item: string }) => `${r.quantity}× **${r.item}**`;
    if (action === "claim") {
      const request = await craftService.claim(guild.id, requestId, member.id);
      await interaction.editReply({ content: `You'll craft ${summary(request)} for ${request.requester.displayName}. Press **Mark done** in the post when it's made.` });
      await dm(request.requester.discordUserId, `🔨 ${request.crafter?.displayName ?? "A guild crafter"} is crafting your ${summary(request)}.`);
    } else if (action === "done") {
      const request = await craftService.complete(guild.id, requestId, member.id, isOfficer);
      await interaction.editReply({ content: `Marked done: ${summary(request)}.` });
      await dm(request.requester.discordUserId, `✅ Your ${summary(request)} is crafted by ${request.crafter?.displayName ?? "a guild crafter"}. Check your mail or arrange a trade.`);
    } else if (action === "release") {
      await craftService.release(guild.id, requestId, member.id, isOfficer);
      await interaction.editReply({ content: "Given back: it is open again." });
    } else if (action === "cancel") {
      const request = await craftService.cancel(guild.id, requestId, member.id, isOfficer);
      await interaction.editReply({ content: "Request cancelled." });
      if (request.crafter) await dm(request.crafter.discordUserId, `The craft request for ${summary(request)} was cancelled.`);
    }
    await syncCraftPost(interaction.guild, requestId);
  } catch (error) {
    await interaction.editReply({ content: error instanceof Error ? error.message : "That didn't work." });
  }
}

function requestModal() {
  const input = (id: string, label: string, placeholder: string, required: boolean, style = TextInputStyle.Short, max = 100) =>
    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId(id).setLabel(label).setPlaceholder(placeholder).setStyle(style).setRequired(required).setMaxLength(max));
  return new ModalBuilder().setCustomId(`${CRAFT_PREFIX}new-modal`).setTitle("Request a craft").addComponents(
    input("item", "Item", "Flask of the Titans", true),
    input("profession", "Profession", "Alchemy", false, TextInputStyle.Short, 40),
    input("quantity", "How many", "1", false, TextInputStyle.Short, 3),
    input("note", "Details (materials, deadline)", "I have the herbs", false, TextInputStyle.Paragraph, 300)
  );
}

// The "Request a craft" form: creates the request and its post.
export async function handleCraftModal(interaction: ModalSubmitInteraction): Promise<void> {
  if (!interaction.guild) return;
  await interaction.deferReply({ ephemeral: true });
  try {
    const guild = await guildService.ensureGuild(interaction.guild.id, interaction.guild.name);
    const member = await guildService.ensureMember(guild.id, interaction.user.id, (interaction.member as GuildMember | null)?.displayName ?? interaction.user.username);
    const typed = interaction.fields.getTextInputValue("profession").trim();
    // Match the typed profession to a known one so the tag and crafter list work.
    const profession = PROFESSIONS.find((name) => name.toLowerCase() === typed.toLowerCase()) ?? PROFESSIONS.find((name) => typed && name.toLowerCase().startsWith(typed.toLowerCase()));
    const quantity = Number(interaction.fields.getTextInputValue("quantity") || "1");
    const request = await craftService.request({
      guildId: guild.id, requesterId: member.id, item: interaction.fields.getTextInputValue("item"), profession,
      quantity: Number.isInteger(quantity) ? quantity : 1, note: interaction.fields.getTextInputValue("note") || undefined, materialsProvided: false
    });
    const posted = await postCraftRequest(interaction.guild, request.id);
    await interaction.editReply({ content: posted.posted ? `Posted: <#${posted.threadId}>. You'll get a DM when a crafter takes it.` : `Request saved (ID \`${request.id}\`), but I couldn't post it to the board: check my permissions on the craft forum.` });
  } catch (error) {
    await interaction.editReply({ content: error instanceof Error ? error.message : "Could not create the request." });
  }
}
