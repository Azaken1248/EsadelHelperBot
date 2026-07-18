import {
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
  type SlashCommandOptionsOnlyBuilder,
} from "discord.js";

import { createEsadelEmbed } from "../../../presentation/esadel-embed";
import type { CommandExecutionContext } from "../../contracts/command-execution-context";
import type { SlashCommand } from "../../contracts/slash-command";

export class RemoveTaskCommand implements SlashCommand {
  readonly data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  readonly requiredRoleIds: readonly string[];

  constructor(adminRoleIds: readonly string[]) {
    this.requiredRoleIds = adminRoleIds;
    this.data = new SlashCommandBuilder()
      .setName("remove-task")
      .setDescription("Remove an existing task entirely from the roster. Admins only.")
      .addStringOption((option) =>
        option
          .setName("assignment_id")
          .setDescription("Assignment Mongo ID")
          .setRequired(true)
          .setAutocomplete(true),
      );
  }

  async execute(
    interaction: ChatInputCommandInteraction,
    context: CommandExecutionContext,
  ): Promise<void> {
    const assignmentId = interaction.options.getString("assignment_id", true);
    const result = await context.assignmentService.removeTask(assignmentId);

    if (!result.success || !result.assignment) {
      await interaction.reply({
        embeds: [
          createEsadelEmbed({
            title: "Esadel Assignment Board",
            description: `> ${result.reason ?? "Task could not be removed."}`,
            tone: "rose",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        createEsadelEmbed({
          title: "Esadel Assignment Board",
          description: `> Task **${result.assignment.taskName}** has been removed entirely from the roster.`,
          tone: "lavender",
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
    const assignments = await context.assignmentService.getPendingTasks();

    const { resolveUsernames } = await import("../../../utils/resolve-usernames.js");
    const userIds = assignments.map((a) => a.discordUserId);
    const nameMap = await resolveUsernames(interaction.client, userIds);

    const choices = assignments
      .filter((a) => {
        const username = nameMap.get(a.discordUserId) ?? a.discordUserId;
        const label = `${a.taskName} ${username} ${a.id}`;
        return label.toLowerCase().includes(focused.toLowerCase());
      })
      .slice(0, 25)
      .map((a) => {
        const username = nameMap.get(a.discordUserId) ?? a.discordUserId;
        return {
          name: `${a.taskName} — ${username}`.slice(0, 100),
          value: a.id as string,
        };
      });

    await interaction.respond(choices);
  }
}
