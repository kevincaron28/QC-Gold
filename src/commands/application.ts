import { ApplicationStatus } from "@prisma/client";
import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { prisma } from "../database.js";
import { createApplicationService } from "../services/application.js";
import { hasPermission } from "../permissions.js";
import { requireGuildContext } from "./context.js";

const applicationService = createApplicationService(prisma);

export const applicationCommand = new SlashCommandBuilder()
  .setName("application").setDescription("Review recruitment applications.")
  .addSubcommand((sub) => sub.setName("list").setDescription("List applications.")
    .addStringOption((o) => o.setName("status").setDescription("Filter status")
      .addChoices(...Object.values(ApplicationStatus).map((status) => ({ name: status, value: status })))))
  .addSubcommand((sub) => sub.setName("view").setDescription("View an application.")
    .addStringOption((o) => o.setName("id").setDescription("Application ID").setRequired(true)))
  .addSubcommand((sub) => sub.setName("approve").setDescription("Approve an application.")
    .addStringOption((o) => o.setName("id").setDescription("Application ID").setRequired(true)))
  .addSubcommand((sub) => sub.setName("reject").setDescription("Reject an application.")
    .addStringOption((o) => o.setName("id").setDescription("Application ID").setRequired(true)))
  .addSubcommand((sub) => sub.setName("trial").setDescription("Move an application to trial.")
    .addStringOption((o) => o.setName("id").setDescription("Application ID").setRequired(true)));

export const applyCommand = new SlashCommandBuilder()
  .setName("apply").setDescription("Submit a recruitment application.")
  .addStringOption((o) => o.setName("character").setDescription("Character name").setRequired(true))
  .addStringOption((o) => o.setName("class").setDescription("Class").setRequired(true))
  .addStringOption((o) => o.setName("spec").setDescription("Specialization").setRequired(true))
  .addStringOption((o) => o.setName("experience").setDescription("Raid experience").setRequired(true))
  .addStringOption((o) => o.setName("availability").setDescription("Availability").setRequired(true))
  .addStringOption((o) => o.setName("notes").setDescription("Additional notes"));

function isOfficer(interaction: ChatInputCommandInteraction): boolean {
  return !!interaction.member && hasPermission(interaction.member as Parameters<typeof hasPermission>[0], "officer");
}

export async function executeApply(interaction: ChatInputCommandInteraction): Promise<void> {
  const context = await requireGuildContext(interaction);
  if (!context) return;
  const notes = interaction.options.getString("notes");
  const application = await applicationService.create({
    guildId: context.guildId, memberId: context.memberId,
    character: interaction.options.getString("character", true),
    className: interaction.options.getString("class", true),
    spec: interaction.options.getString("spec", true),
    experience: interaction.options.getString("experience", true),
    availability: interaction.options.getString("availability", true),
    ...(notes ? { notes } : {})
  });
  await interaction.reply({ content: `Application submitted. Your application ID is \`${application.id}\`.`, ephemeral: true });
}

export async function executeApplication(interaction: ChatInputCommandInteraction): Promise<void> {
  const context = await requireGuildContext(interaction);
  if (!context) return;
  if (!isOfficer(interaction)) {
    await interaction.reply({ content: "Only officers, Guild Masters, or administrators can view or review applications.", ephemeral: true });
    return;
  }
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === "list") {
    const rawStatus = interaction.options.getString("status") as ApplicationStatus | null;
    const applications = await applicationService.list(context.guildId, rawStatus ?? undefined);
    await interaction.reply(applications.length
      ? applications.map((app) => `\`${app.id}\` — **${app.character}** (<@${app.member.discordUserId}>) — ${app.status}`).join("\n")
      : "No applications found.");
    return;
  }
  const id = interaction.options.getString("id", true);
  if (subcommand === "view") {
    const app = await applicationService.get(context.guildId, id);
    if (!app) throw new Error("Application not found");
    await interaction.reply(`\`${app.id}\` **${app.character}** — ${app.status}\nClass/spec: ${app.className} / ${app.spec}\nExperience: ${app.experience}\nAvailability: ${app.availability}${app.notes ? `\nNotes: ${app.notes}` : ""}`);
    return;
  }
  const status = ({ approve: ApplicationStatus.APPROVED, reject: ApplicationStatus.REJECTED, trial: ApplicationStatus.TRIAL } as const)[subcommand as "approve" | "reject" | "trial"];
  const updated = await applicationService.transition(context.guildId, id, status, interaction.user.id);
  await interaction.reply(`Application \`${updated.id}\` is now **${updated.status}**.`);
}
