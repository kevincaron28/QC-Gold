import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  UserSelectMenuBuilder, type ChatInputCommandInteraction, type Message, type MessageComponentInteraction
} from "discord.js";
import type { RaidCore, RaidRole } from "@prisma/client";
import { prisma } from "../database.js";
import { describeRules, effectiveRules } from "../services/core-rules.js";
import { coreRosterEmbed, createRaidCoreService, syncCoreRoster } from "../services/raid-core.js";
import { guildService } from "./context.js";

// /core setup: build a raid core by clicking, not by remembering commands.
//   1. name it (a small form)          2. pick its tanks, healers and DPS from member menus
//   3. rules: same as the guild (default), or its own point pool / loot council / EP values
// Everything is saved as you go; closing the message loses nothing.

const coreService = createRaidCoreService(prisma);
const ROLE_LABEL: Record<RaidRole, string> = { TANK: "Tanks", HEALER: "Healers", DPS: "DPS" };

const btn = (id: string, label: string, style: ButtonStyle = ButtonStyle.Secondary) =>
  new ButtonBuilder().setCustomId(`corewiz:${id}`).setLabel(label).setStyle(style);

function nameStep() {
  const embed = new EmbedBuilder().setColor(0xd4af37).setTitle("⚜️ New raid core — step 1 of 3: name it")
    .setDescription([
      "A **raid core** is a named roster (for example *Tuesday Molten Core*). Its members get **priority at signups** for that core's raids, and its roster shows live in the raid roster channel.",
      "You can make as many cores as you like.",
      "",
      "Press **Name your core** and type a name."
    ].join("\n"));
  return { embeds: [embed], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(btn("name", "Name your core", ButtonStyle.Primary), btn("cancel", "Cancel"))] };
}

async function rosterStep(core: { id: string; name: string; description: string | null }, guildId: string, note: string) {
  const full = await coreService.byIdOrName(guildId, core.id);
  const embed = coreRosterEmbed(full).setTitle(`⚜️ ${core.name} — step 2 of 3: pick the players`)
    .setDescription([
      "Pick people from each menu: tanks, healers, DPS. Each pick is saved at once; you can use a menu again to add more.",
      "To change roles, use the bench or remove someone later: `/core edit`.",
      note ? `\n**Last action:** ${note}` : ""
    ].join("\n"));
  const menu = (id: string, placeholder: string) => new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
    new UserSelectMenuBuilder().setCustomId(`corewiz:${id}`).setPlaceholder(placeholder).setMinValues(1).setMaxValues(25));
  return {
    embeds: [embed],
    components: [
      menu("pick-TANK", "🛡️ Add tanks"),
      menu("pick-HEALER", "💚 Add healers"),
      menu("pick-DPS", "⚔️ Add DPS"),
      new ActionRowBuilder<ButtonBuilder>().addComponents(btn("rules", "Next: rules ▶", ButtonStyle.Primary), btn("finish", "Skip rules, finish", ButtonStyle.Success))
    ]
  };
}

async function rulesStep(coreId: string, guildId: string, note: string) {
  const core = await prisma.raidCore.findUniqueOrThrow({ where: { id: coreId } });
  const rules = effectiveRules(await guildService.getSettings(guildId), core);
  const embed = new EmbedBuilder().setColor(0xd4af37).setTitle(`⚜️ ${core.name} — step 3 of 3: rules`)
    .setDescription([
      "By default a core follows **the guild's rules** (EP values, loot, points), exactly like every other core. Change only what should differ.",
      "",
      describeRules(rules, core.name),
      note ? `\n**Last action:** ${note}` : ""
    ].join("\n"));
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        btn("ep", "Change EP values"),
        btn("pool", core.separatePool ? "Own point pool: ON" : "Own point pool: off", core.separatePool ? ButtonStyle.Success : ButtonStyle.Secondary),
        btn("council", rules.lootMode === "COUNCIL" && core.lootMode ? "Loot council: ON" : "Loot council: off", core.lootMode === "COUNCIL" ? ButtonStyle.Success : ButtonStyle.Secondary)
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(btn("back", "◀ Players"), btn("finish", "Finish ✔", ButtonStyle.Success))
    ]
  };
}

function nameModal() {
  return new ModalBuilder().setCustomId("corewiz:name-modal").setTitle("New raid core").addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("name").setLabel("Name").setPlaceholder("Tuesday Molten Core").setStyle(TextInputStyle.Short).setMinLength(2).setMaxLength(50).setRequired(true)),
    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("description").setLabel("Description (optional)").setPlaceholder("Tuesdays 8pm, progression").setStyle(TextInputStyle.Short).setMaxLength(300).setRequired(false))
  );
}

export function epModal(core: RaidCore) {
  // Discord limits: a label and the title are at most 45 characters, and an empty value is not allowed.
  const input = (id: string, label: string, value: number | null) => {
    const field = new TextInputBuilder().setCustomId(id).setLabel(label).setPlaceholder("empty = guild default")
      .setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(5);
    if (value !== null) field.setValue(String(value));
    return new ActionRowBuilder<TextInputBuilder>().addComponents(field);
  };
  return new ModalBuilder().setCustomId("corewiz:ep-modal").setTitle(`EP values: ${core.name}`.slice(0, 45)).addComponents(
    input("attendance", "EP for attending", core.attendanceEp), input("late", "EP for arriving late", core.lateEp),
    input("boss", "EP per boss killed", core.bossEp), input("clear", "Bonus EP for a full clear", core.completionEp));
}

// "" keeps the guild default (null); anything else must be a whole number 0 or more.
export function parseEpField(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  if (!/^\d{1,5}$/.test(trimmed)) throw new Error(`"${trimmed}" is not a whole number of EP.`);
  return Number(trimmed);
}

export async function runCoreWizard(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = (await guildService.ensureGuild(interaction.guildId ?? "", interaction.guild?.name ?? "")).id;
  await interaction.reply({ ...nameStep(), ephemeral: true });
  const message: Message = await interaction.fetchReply();
  const collector = message.createMessageComponentCollector({ time: 20 * 60_000, filter: (i) => i.user.id === interaction.user.id });
  let coreId: string | null = null;

  const show = async (payload: Awaited<ReturnType<typeof rosterStep>> | ReturnType<typeof nameStep>) => { await interaction.editReply(payload); };

  collector.on("collect", async (i: MessageComponentInteraction) => {
    const action = i.customId.replace("corewiz:", "");
    try {
      if (action === "cancel") {
        await i.update({ content: "Cancelled. Nothing was created.", embeds: [], components: [] });
        collector.stop("closed");
        return;
      }
      if (action === "name" && i.isButton()) {
        await i.showModal(nameModal());
        const submitted = await i.awaitModalSubmit({ time: 5 * 60_000, filter: (m) => m.user.id === i.user.id }).catch(() => null);
        if (!submitted) return;
        try {
          const core = await coreService.create(guildId, submitted.fields.getTextInputValue("name"), submitted.fields.getTextInputValue("description") || null);
          coreId = core.id;
          await submitted.deferUpdate();
          await show(await rosterStep(core, guildId, `Created **${core.name}**.`));
        } catch (error) {
          await submitted.reply({ content: error instanceof Error ? error.message : "Could not create the core.", ephemeral: true });
        }
        return;
      }
      if (!coreId) return;
      const core = await prisma.raidCore.findUniqueOrThrow({ where: { id: coreId } });
      if (action.startsWith("pick-") && i.isUserSelectMenu()) {
        await i.deferUpdate();
        const role = action.slice("pick-".length) as RaidRole;
        const added: string[] = [];
        for (const userId of i.values) {
          const person = await interaction.guild?.members.fetch(userId).catch(() => null);
          if (!person || person.user.bot) continue;
          const member = await guildService.ensureMember(guildId, userId, person.displayName);
          await coreService.addMember(guildId, coreId, member.id, role);
          added.push(person.displayName);
        }
        await syncCoreRoster(interaction.guild, prisma, guildId, coreId);
        await show(await rosterStep(core, guildId, added.length ? `Added ${added.join(", ")} as ${ROLE_LABEL[role]}.` : "Nobody added (bots are skipped)."));
        return;
      }
      if (action === "rules" || action === "back") {
        await i.deferUpdate();
        await interaction.editReply(action === "rules" ? await rulesStep(coreId, guildId, "") : await rosterStep(core, guildId, ""));
        return;
      }
      if (action === "pool" || action === "council") {
        await i.deferUpdate();
        let note: string;
        if (action === "pool") {
          await prisma.raidCore.update({ where: { id: coreId }, data: { separatePool: !core.separatePool } });
          note = !core.separatePool ? "This core now has its own point pool (from now on)." : "Back to the shared guild pool.";
        } else {
          await prisma.raidCore.update({ where: { id: coreId }, data: { lootMode: core.lootMode === "COUNCIL" ? null : "COUNCIL" } });
          note = core.lootMode === "COUNCIL" ? "Loot follows the guild again." : "This core now decides loot by council (officers use /loot award).";
        }
        await interaction.editReply(await rulesStep(coreId, guildId, note));
        return;
      }
      if (action === "ep" && i.isButton()) {
        await i.showModal(epModal(core));
        const submitted = await i.awaitModalSubmit({ time: 5 * 60_000, filter: (m) => m.user.id === i.user.id }).catch(() => null);
        if (!submitted) return;
        try {
          await prisma.raidCore.update({
            where: { id: coreId },
            data: {
              attendanceEp: parseEpField(submitted.fields.getTextInputValue("attendance")), lateEp: parseEpField(submitted.fields.getTextInputValue("late")),
              bossEp: parseEpField(submitted.fields.getTextInputValue("boss")), completionEp: parseEpField(submitted.fields.getTextInputValue("clear"))
            }
          });
          await submitted.deferUpdate();
          await interaction.editReply(await rulesStep(coreId, guildId, "EP values saved."));
        } catch (error) {
          await submitted.reply({ content: error instanceof Error ? error.message : "Could not save.", ephemeral: true });
        }
        return;
      }
      if (action === "finish") {
        await syncCoreRoster(interaction.guild, prisma, guildId, coreId);
        const settings = await guildService.getSettings(guildId);
        await i.update({
          content: `✅ **${core.name}** is ready.\n`
            + `• Create its raids with \`/raid create core:${core.name}\` (its members get signup priority).\n`
            + `• Change the roster any time (roles, bench, add, remove): \`/core edit core:${core.name}\`; rules: \`/core rules\`.\n`
            + (settings?.coreChannelId ? `• Its roster is posted in <#${settings.coreChannelId}>.` : "• Set a raid roster channel in `/setup` step 3 to show the roster there."),
          embeds: [], components: []
        });
        collector.stop("closed");
      }
    } catch (error) {
      console.error("Core wizard step failed", error);
      const text = error instanceof Error ? error.message : String(error);
      if (!i.replied && !i.deferred) await i.reply({ content: `That didn't work: ${text}`, ephemeral: true }).catch(() => undefined);
      else await i.followUp({ content: `That didn't work: ${text}`, ephemeral: true }).catch(() => undefined);
    }
  });
  collector.on("end", async (_c, reason) => {
    if (reason !== "closed") await interaction.editReply({ content: "The core wizard timed out. What you saved is kept; use /core setup to continue or /core add.", embeds: [], components: [] }).catch(() => undefined);
  });
}
