import {
  ActionRowBuilder,
  type AutocompleteInteraction,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
  type SlashCommandOptionsOnlyBuilder,
  type TextChannel,
} from "discord.js";

import { SPECIALIZED_ROLE_LABELS, type SpecializedRoleKey } from "../../../config/constants";
import { createEsadelEmbed } from "../../../presentation/esadel-embed";
import { reactSafely } from "../../../utils/reactions";
import type { CommandExecutionContext } from "../../contracts/command-execution-context";
import type { SlashCommand } from "../../contracts/slash-command";

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

export class SubmitCommand implements SlashCommand {
  readonly data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder = new SlashCommandBuilder()
    .setName("submit")
    .setDescription("Submit a pending task for review by an owner or mod.")
    .addStringOption((option) =>
      option
        .setName("assignment_id")
        .setDescription("The ID of the assignment to submit")
        .setRequired(true)
        .setAutocomplete(true),
    );

  async execute(
    interaction: ChatInputCommandInteraction,
    context: CommandExecutionContext,
  ): Promise<void> {
    const assignmentId = interaction.options.getString("assignment_id", true);

    const result = await context.assignmentService.submitTask({
      assignmentId,
      discordUserId: interaction.user.id,
    });

    if (result.status !== "submitted" || !result.assignment) {
      await interaction.reply({
        embeds: [
          createEsadelEmbed({
            title: "Esadel Submission Desk",
            description: `> Aw, **Submission Failed** ~ ${result.reason ?? "Unknown reason."} Let's sort it out, okay? ♡`,
            tone: "rose",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const assignment = result.assignment;
    const unixDeadline = Math.floor(assignment.deadline.getTime() / 1000);
    const roleLabel = resolveRoleLabel(assignment.roleId, context.config.roles.specialized);
    const ownerRoleId = context.config.roles.owners;

    const approvalEmbed = createEsadelEmbed({
      title: "Esadel Submission Desk — Awaiting Review",
      description: `> Ta-da~! <@${assignment.discordUserId}> just handed in a task for review! Owners, mods — come take a peek, okay? ♪`,
      tone: "lavender",
      voiceWrap: false,
      fields: [
        {
          name: "◈ Task",
          value: `> **${assignment.taskName}**`,
          inline: true,
        },
        {
          name: "◈ Role",
          value: `> \` ${roleLabel} \``,
          inline: true,
        },
        {
          name: "◈ Deadline",
          value: `> <t:${unixDeadline}:F>\n> (<t:${unixDeadline}:R>)`,
          inline: true,
        },
        {
          name: "◈ Description",
          value: `> ${assignment.description || "No additional details provided."}`,
          inline: false,
        },
        {
          name: "◈ Assignment ID",
          value: `> \`${assignment.id}\``,
          inline: false,
        },
      ],
    });

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`submit_approve:${assignment.id}`)
        .setLabel("Approve")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`submit_deny:${assignment.id}`)
        .setLabel("Deny")
        .setStyle(ButtonStyle.Danger),
    );

    const approvalPayload = {
      content: `<@&${ownerRoleId}> — a submission is awaiting review!`,
      embeds: [approvalEmbed],
      components: [actionRow],
    };

    // Post the approval embed in the current channel/thread
    if (!interaction.channel || !("send" in interaction.channel)) {
      await interaction.reply({
        embeds: [
          createEsadelEmbed({
            title: "Esadel Submission Desk",
            description: "> I can't post the approval embed here. Make sure I have permission to send messages in this channel.",
            tone: "rose",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      const approvalMessage = await interaction.channel.send(approvalPayload);
      await reactSafely(approvalMessage, ["🎀"]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown send failure.";
      context.logger.error("Failed to send approval embed to current channel.", {
        channelId: interaction.channelId,
        assignmentId: assignment.id,
        errorMessage,
      });

      await interaction.reply({
        embeds: [
          createEsadelEmbed({
            title: "Esadel Submission Desk",
            description: "> I could not post the approval request in this channel. Please check my permissions and try again.",
            tone: "rose",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // If a dedicated approval channel is configured, cross-post there too
    const approvalChannelId = context.config.channels.approvalChannelId;
    if (approvalChannelId && approvalChannelId !== interaction.channelId) {
      try {
        const approvalChannel = await interaction.client.channels.fetch(approvalChannelId);
        if (approvalChannel && "send" in approvalChannel) {
          await (approvalChannel as TextChannel).send({
            embeds: [approvalEmbed],
            components: [actionRow],
          });
        }
      } catch {
        // Cross-post failure is non-critical — the primary post already succeeded
        context.logger.warn("Failed to cross-post approval embed to approval channel.", {
          approvalChannelId,
          assignmentId: assignment.id,
        });
      }
    }

    await interaction.reply({
      embeds: [
        createEsadelEmbed({
          title: "Esadel Submission Desk",
          description: `> Yay, your task **${assignment.taskName}** is submitted for review! I'll tell the admins right away — good job finishing it, hehe~ ♪`,
          tone: "sakura",
          fields: [
            {
              name: "◈ Assignment ID",
              value: `> \`${assignment.id}\``,
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
