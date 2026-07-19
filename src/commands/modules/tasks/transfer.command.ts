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

export class TransferTaskCommand implements SlashCommand {
  readonly data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  readonly requiredRoleIds: readonly string[];

  constructor(adminRoleIds: readonly string[]) {
    this.requiredRoleIds = adminRoleIds;
    this.data = new SlashCommandBuilder()
      .setName("transfer-task")
      .setDescription("Transfer a task to another active crew member. Admins only.")
      .addStringOption((option) =>
        option
          .setName("assignment_id")
          .setDescription("Assignment Mongo ID")
          .setRequired(true)
          .setAutocomplete(true),
      )
      .addUserOption((option) =>
        option
          .setName("new_member")
          .setDescription("Crew member to receive the task")
          .setRequired(true),
      );
  }

  async execute(
    interaction: ChatInputCommandInteraction,
    context: CommandExecutionContext,
  ): Promise<void> {
    const assignmentId = interaction.options.getString("assignment_id", true);
    const newMember = interaction.options.getUser("new_member", true);

    const result = await context.assignmentService.transferTask(assignmentId, newMember.id);

    if (!result.success || !result.assignment) {
      await interaction.reply({
        embeds: [
          createEsadelEmbed({
            title: "Esadel Assignment Board",
            description: `> ${result.reason ?? "Task could not be transferred."}`,
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
          description: `> All done~! Task **${result.assignment.taskName}** has been successfully transferred. They'll take it from here, so you're free to go, hehe~ ♪`,
          tone: "lavender",
          fields: [
            {
              name: "◈ Previous Assignee",
              value: `> <@${result.oldDiscordUserId}>`,
              inline: true,
            },
            {
              name: "◈ New Assignee",
              value: `> <@${newMember.id}>`,
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
