import {
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
  type SlashCommandOptionsOnlyBuilder,
} from "discord.js";

import { createEsadelEmbed } from "../../../presentation/esadel-embed";
import { parseNaturalDate } from "../../../utils/date-parser";
import type { CommandExecutionContext } from "../../contracts/command-execution-context";
import type { SlashCommand } from "../../contracts/slash-command";

export class ExtensionCommand implements SlashCommand {
  readonly data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder = new SlashCommandBuilder()
    .setName("extend")
    .setDescription("Request a deadline extension for one of your pending tasks.")
    .addStringOption((option) =>
      option
        .setName("assignment_id")
        .setDescription("The ID of the assignment to extend")
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addStringOption((option) =>
      option
        .setName("new_deadline")
        .setDescription('e.g., "tomorrow", "in 3 days", "Oct 24", "next friday"')
        .setRequired(true),
    );

  async execute(
    interaction: ChatInputCommandInteraction,
    context: CommandExecutionContext,
  ): Promise<void> {
    const assignmentId = interaction.options.getString("assignment_id", true);
    const deadlineInput = interaction.options.getString("new_deadline", true);

    const newDeadline = parseNaturalDate(deadlineInput);

    if (!newDeadline || newDeadline.getTime() <= Date.now()) {
      await interaction.reply({
        embeds: [
          createEsadelEmbed({
            title: "Esadel Extension Board",
            description: `> Hmm~ I couldn't understand the date \`${deadlineInput}\`, or it's already in the past. Try something like \`"in 3 days"\`, okay? ♪`,
            tone: "rose",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const result = await context.assignmentService.requestExtension({
      assignmentId,
      discordUserId: interaction.user.id,
      newDeadline,
    });

    if (!result.allowed || !result.assignment) {
      await interaction.reply({
        embeds: [
          createEsadelEmbed({
            title: "Esadel Extension Board",
            description: `> Ah... **Extension Denied** ~ ${result.reason ?? "Unknown reason."} Let's see what we can do with what we've got, okay?`,
            tone: "rose",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const unixDeadline = Math.floor(result.assignment.deadline.getTime() / 1000);

    await interaction.reply({
      embeds: [
        createEsadelEmbed({
          title: "Esadel Extension Board",
          description: `> Extension approved~! Take the extra time to make it perfect — I know it'll turn out super cute! ♡`,
          tone: "sakura",
          fields: [
            {
              name: "◈ New Deadline",
              value: `> <t:${unixDeadline}:F>\n> (<t:${unixDeadline}:R>)`,
              inline: true,
            },
            {
              name: "◈ Extensions Used",
              value: `> \` ${result.assignment.extensionsGranted} \``,
              inline: true,
            },
          ],
        }),
      ],
      flags: MessageFlags.Ephemeral,
    });
  }

  async autocomplete(
    interaction: AutocompleteInteraction,
    context: CommandExecutionContext,
  ): Promise<void> {
    const focused = interaction.options.getFocused();
    const assignments = await context.assignmentService.getPendingTasks(interaction.user.id);

    const choices = assignments
      .filter((a) => {
        const label = `${a.taskName} (${a.id})`;
        return label.toLowerCase().includes(focused.toLowerCase());
      })
      .slice(0, 25)
      .map((a) => {
        const deadlineStr = a.deadline.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        return {
          name: `${a.taskName} — due ${deadlineStr}`.slice(0, 100),
          value: a.id as string,
        };
      });

    await interaction.respond(choices);
  }
}
