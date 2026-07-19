import {
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
  type SlashCommandOptionsOnlyBuilder,
} from "discord.js";

import { SPECIALIZED_ROLE_LABELS, type SpecializedRoleKey } from "../../../config/constants";
import { createEsadelEmbed } from "../../../presentation/esadel-embed";
import { parseNaturalDate } from "../../../utils/date-parser";
import type { CommandExecutionContext } from "../../contracts/command-execution-context";
import type { SlashCommand } from "../../contracts/slash-command";

export class AssignCommand implements SlashCommand {
  readonly data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  readonly requiredRoleIds: readonly string[];
  private readonly specializedRoles: Record<string, string>;

  constructor(adminRoleIds: readonly string[], specializedRoles: Record<string, string>) {
    this.requiredRoleIds = adminRoleIds;
    this.specializedRoles = specializedRoles;

    const roleChoices = Object.entries(specializedRoles).map(([key, value]) => ({
      name: SPECIALIZED_ROLE_LABELS[key as SpecializedRoleKey] || key,
      value,
    }));

    const builder = new SlashCommandBuilder()
      .setName("assign")
      .setDescription("Assign a new task to a crew member.")
      .addUserOption((option) =>
        option.setName("member").setDescription("Crew member").setRequired(true),
      );

    builder.addStringOption((option) => {
      option
        .setName("role")
        .setDescription("Task domain (Art, Audio, etc.)")
        .setRequired(true);
      if (roleChoices.length > 0) {
        option.addChoices(...roleChoices);
      }
      return option;
    });

    builder
      .addStringOption((option) =>
        option.setName("task").setDescription("Short task name (e.g. Draw Card)").setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName("deadline")
          .setDescription('e.g., "tomorrow", "in 3 days", "Oct 24", "next friday"')
          .setRequired(true),
      )
      .addStringOption((option) =>
        option.setName("description").setDescription("Task details").setRequired(false),
      )
      .addBooleanOption((option) =>
        option
          .setName("is_time_limited")
          .setDescription("Strict deadline? (Blocks the /extend command). Defaults to False.")
          .setRequired(false),
      );

    this.data = builder;
  }

  async execute(
    interaction: ChatInputCommandInteraction,
    context: CommandExecutionContext,
  ): Promise<void> {
    const member = interaction.options.getUser("member", true);
    const roleId = interaction.options.getString("role", true);
    const taskName = interaction.options.getString("task", true);
    const deadlineInput = interaction.options.getString("deadline", true);
    const description = interaction.options.getString("description") ?? "No additional details provided.";

    const isTimeLimited = interaction.options.getBoolean("is_time_limited") ?? false;

    const deadline = parseNaturalDate(deadlineInput);

    if (!deadline || deadline.getTime() <= Date.now()) {
      await interaction.reply({
        embeds: [
          createEsadelEmbed({
            title: "Esadel Assignment Board",
            description: `> Mmm, I couldn't understand the deadline \`${deadlineInput}\`, or it's already in the past~ Give me something clear and cute like \`"tomorrow"\` or \`"in 3 days"\`, okay? ♪`,
            tone: "rose",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      const assignment = await context.assignmentService.assignTask({
        discordUserId: member.id,
        roleId,
        taskName,
        description,
        deadline,
        isTimeLimited,
      });

      const timeLimitText = isTimeLimited ? "Yes (Extensions Blocked 🛑)" : "No (Extensions Allowed ✨)";
      const unixDeadline = Math.floor(assignment.deadline.getTime() / 1000);

      await interaction.reply({
        embeds: [
          createEsadelEmbed({
            title: "Esadel Assignment Board",
            description: `> Ooh, a brand-new task to style~! I've handed it to <@${member.id}>. Let's make it look amazing, hehe~ ♡`,
            tone: "sakura",
            fields: [
              { name: "◈ Task", value: `> **${assignment.taskName}**`, inline: true },
              { name: "◈ Deadline", value: `> <t:${unixDeadline}:F>\n> (<t:${unixDeadline}:R>)`, inline: true },
              { name: "◈ Strict Limit", value: `> \` ${timeLimitText} \``, inline: false },
            ],
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred.";
      await interaction.reply({
        embeds: [
          createEsadelEmbed({
            title: "Esadel Assignment Board",
            description: `> Aww, I couldn't assign that one~ ${errorMessage}`,
            tone: "rose",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}
