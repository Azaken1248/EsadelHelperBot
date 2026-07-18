import {
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
  type SlashCommandOptionsOnlyBuilder,
} from "discord.js";

import { SPECIALIZED_ROLE_LABELS, type SpecializedRoleKey } from "../../../config/constants";
import { createEsadelEmbed } from "../../../presentation/esadel-embed";
import { parseNaturalDate } from "../../../utils/date-parser";
import { parseUserMentions } from "../../../utils/parse-mentions";
import { resolveUsernames } from "../../../utils/resolve-usernames";
import type { CommandExecutionContext } from "../../contracts/command-execution-context";
import type { SlashCommand } from "../../contracts/slash-command";

interface EmbedField {
  name: string;
  value: string;
  inline: boolean;
}

export class BulkAssignCommand implements SlashCommand {
  readonly data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  readonly requiredRoleIds: readonly string[];

  constructor(adminRoleIds: readonly string[], specializedRoles: Record<string, string>) {
    this.requiredRoleIds = adminRoleIds;

    const roleChoices = Object.entries(specializedRoles).map(([key, value]) => ({
      name: SPECIALIZED_ROLE_LABELS[key as SpecializedRoleKey] || key,
      value,
    }));

    const builder = new SlashCommandBuilder()
      .setName("bulkassign")
      .setDescription("Assign the same task to multiple crew members at once. Admins only.")
      .addStringOption((option) =>
        option
          .setName("members")
          .setDescription("Members to assign (mention them, e.g. @a @b @c)")
          .setRequired(true),
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
    const membersInput = interaction.options.getString("members", true);
    const roleId = interaction.options.getString("role", true);
    const taskName = interaction.options.getString("task", true);
    const deadlineInput = interaction.options.getString("deadline", true);
    const description = interaction.options.getString("description") ?? "No additional details provided.";
    const isTimeLimited = interaction.options.getBoolean("is_time_limited") ?? false;

    const userIds = parseUserMentions(membersInput);
    if (userIds.length === 0) {
      await interaction.reply({
        embeds: [
          createEsadelEmbed({
            title: "Esadel Bulk Assignment",
            description: "> I couldn't find any members in that input~ Try mentioning them like `@a @b @c`.",
            tone: "rose",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const deadline = parseNaturalDate(deadlineInput);
    if (!deadline || deadline.getTime() <= Date.now()) {
      await interaction.reply({
        embeds: [
          createEsadelEmbed({
            title: "Esadel Bulk Assignment",
            description: `> I couldn't understand the deadline \`${deadlineInput}\`, or it's in the past! Try \`"tomorrow"\` or \`"in 3 days"\`.`,
            tone: "rose",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const nameMap = await resolveUsernames(interaction.client, userIds);
    const targets = userIds.map((id) => ({
      discordUserId: id,
      username: nameMap.get(id) ?? id,
    }));

    const result = await context.bulkAssignmentService.assignBulk({
      targets,
      roleId,
      taskName,
      description,
      deadline,
      isTimeLimited,
    });

    const successLines = result.results
      .filter((entry) => entry.success)
      .map((entry) => `> ✅ <@${entry.discordUserId}>`);
    const failLines = result.results
      .filter((entry) => !entry.success)
      .map((entry) => `> ❌ <@${entry.discordUserId}> — ${entry.error ?? "Unknown error."}`);

    const unixDeadline = Math.floor(deadline.getTime() / 1000);

    const description_ =
      result.failed === 0
        ? `> Yay! I've assigned **${taskName}** to ${result.succeeded} member(s) successfully! Let's get styling! ♪`
        : `> Oh, I tried bulk assigning **${taskName}**, but there were some issues for a few members~ Check the details below:`;

    const fields: EmbedField[] = [];
    if (successLines.length > 0) {
      fields.push({
        name: `◈ Assigned (${result.succeeded})`,
        value: successLines.join("\n").slice(0, 1024),
        inline: false,
      });
    }
    if (failLines.length > 0) {
      fields.push({
        name: `◈ Failed (${result.failed})`,
        value: failLines.join("\n").slice(0, 1024),
        inline: false,
      });
    }
    fields.push({
      name: "◈ Deadline",
      value: `> <t:${unixDeadline}:F> (<t:${unixDeadline}:R>)`,
      inline: false,
    });

    await interaction.editReply({
      embeds: [
        createEsadelEmbed({
          title: "Esadel Bulk Assignment",
          description: description_,
          tone: result.failed === 0 ? "sakura" : "rose",
          voiceWrap: false,
          fields,
        }),
      ],
    });
  }
}
