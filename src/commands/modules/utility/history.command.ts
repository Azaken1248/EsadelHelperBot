import {
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
  type SlashCommandOptionsOnlyBuilder,
} from "discord.js";

import { SPECIALIZED_ROLE_LABELS, type SpecializedRoleKey } from "../../../config/constants";
import type { AssignmentStatus } from "../../../models/assignment.model";
import { createEsadelEmbed } from "../../../presentation/esadel-embed";
import type { HistoryFilter } from "../../../repositories/interfaces/assignment-repository";
import type { CommandExecutionContext } from "../../contracts/command-execution-context";
import type { SlashCommand } from "../../contracts/slash-command";

const STATUS_CHOICES: { name: string; value: AssignmentStatus }[] = [
  { name: "Pending", value: "PENDING" },
  { name: "Completed", value: "COMPLETED" },
  { name: "Late", value: "LATE" },
  { name: "Excused", value: "EXCUSED" },
];

const STATUS_EMOJI: Record<AssignmentStatus, string> = {
  PENDING: "⏳",
  COMPLETED: "✅",
  LATE: "🔴",
  EXCUSED: "🟡",
};

const resolveRoleLabel = (
  roleId: string,
  specializedRoles: Record<string, string>,
): string => {
  for (const [key, id] of Object.entries(specializedRoles)) {
    if (id === roleId) {
      return SPECIALIZED_ROLE_LABELS[key as SpecializedRoleKey] ?? key;
    }
  }

  return "Unknown";
};

export class HistoryCommand implements SlashCommand {
  readonly data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;

  constructor(
    private readonly adminRoleIds: readonly string[],
    private readonly specializedRoles: Record<string, string>,
  ) {
    const roleChoices = Object.entries(specializedRoles).map(([key, value]) => ({
      name: SPECIALIZED_ROLE_LABELS[key as SpecializedRoleKey] || key,
      value,
    }));

    const builder = new SlashCommandBuilder()
      .setName("history")
      .setDescription("Search and view task history with filters.")
      .addUserOption((option) =>
        option
          .setName("member")
          .setDescription("Crew member to look up (defaults to yourself)")
          .setRequired(false),
      )
      .addStringOption((option) =>
        option
          .setName("status")
          .setDescription("Filter by task status")
          .setRequired(false)
          .addChoices(...STATUS_CHOICES),
      );

    builder.addStringOption((option) => {
      option
        .setName("role")
        .setDescription("Filter by task domain")
        .setRequired(false);
      if (roleChoices.length > 0) {
        option.addChoices(...roleChoices);
      }
      return option;
    });

    builder.addStringOption((option) =>
      option
        .setName("search")
        .setDescription("Search by task name (case-insensitive)")
        .setRequired(false),
    );

    this.data = builder;
  }

  async execute(
    interaction: ChatInputCommandInteraction,
    context: CommandExecutionContext,
  ): Promise<void> {
    const targetUser = interaction.options.getUser("member") ?? interaction.user;
    const statusFilter = interaction.options.getString("status") as AssignmentStatus | null;
    const roleFilter = interaction.options.getString("role");
    const searchFilter = interaction.options.getString("search");

    const filter: HistoryFilter = {};
    if (statusFilter) filter.status = statusFilter;
    if (roleFilter) filter.roleId = roleFilter;
    if (searchFilter) filter.taskName = searchFilter;

    const assignments = await context.assignmentService.getHistory(targetUser.id, filter);

    if (assignments.length === 0) {
      const filterParts: string[] = [];
      if (statusFilter) filterParts.push(`status: \`${statusFilter}\``);
      if (roleFilter) filterParts.push(`role: \`${resolveRoleLabel(roleFilter, this.specializedRoles)}\``);
      if (searchFilter) filterParts.push(`search: \`${searchFilter}\``);
      const filterSummary = filterParts.length > 0 ? ` with filters (${filterParts.join(", ")})` : "";

      await interaction.reply({
        embeds: [
          createEsadelEmbed({
            title: "Esadel History Archive",
            description: `> No task records found for <@${targetUser.id}>${filterSummary}. A clean slate can be a fresh start! ✨`,
            tone: "lavender",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const fields = assignments.slice(0, 25).map((task, index) => {
      const unixDeadline = Math.floor(task.deadline.getTime() / 1000);
      const statusEmoji = STATUS_EMOJI[task.status] ?? "❓";
      const roleLabel = resolveRoleLabel(task.roleId, this.specializedRoles);

      return {
        name: `◈ ${index + 1}. ${task.taskName}`,
        value:
          `> ${statusEmoji} **${task.status}** | \` ${roleLabel} \`\n` +
          `> **Deadline:** <t:${unixDeadline}:f> (<t:${unixDeadline}:R>)\n` +
          `> **ID:** \`${task.id}\``,
        inline: false,
      };
    });

    const filterParts: string[] = [];
    if (statusFilter) filterParts.push(`Status: \`${statusFilter}\``);
    if (roleFilter) filterParts.push(`Role: \`${resolveRoleLabel(roleFilter, this.specializedRoles)}\``);
    if (searchFilter) filterParts.push(`Search: \`${searchFilter}\``);

    const filterLine = filterParts.length > 0 ? `\n> **Filters:** ${filterParts.join(" · ")}` : "";
    const countLine = `\n> Showing **${assignments.length}** record${assignments.length !== 1 ? "s" : ""}`;

    await interaction.reply({
      embeds: [
        createEsadelEmbed({
          title: "Esadel History Archive",
          description: `> Here's the task history for <@${targetUser.id}>! Every record tells a story of progress. ♪${filterLine}${countLine}`,
          tone: "lavender",
          fields,
        }),
      ],
      flags: MessageFlags.Ephemeral,
    });
  }
}
