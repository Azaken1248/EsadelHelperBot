import {
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
  type SlashCommandOptionsOnlyBuilder,
} from "discord.js";

import { createEsadelEmbed, type EsadelTone } from "../../../presentation/esadel-embed";
import type { DeboardStatus } from "../../../services/user-service";
import type { CommandExecutionContext } from "../../contracts/command-execution-context";
import type { SlashCommand } from "../../contracts/slash-command";
import { ensureOwnerAccess } from "./owner-access";

const normalizeDeboardMessage = (message: string): string => {
  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return "No farewell note was recorded.";
  }

  if (/different\s+sekai/i.test(trimmed)) {
    return "Moved to a different team.";
  }

  return trimmed;
};

export class DeboardCommand implements SlashCommand {
  readonly data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder = new SlashCommandBuilder()
    .setName("deboard")
    .setDescription("Deboard a member from active crew status. Owners only.")
    .addUserOption((option) =>
      option.setName("member").setDescription("Member to deboard").setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Optional deboard note")
        .setRequired(false)
        .setMaxLength(300),
    );

  async execute(
    interaction: ChatInputCommandInteraction,
    context: CommandExecutionContext,
  ): Promise<void> {
    const hasOwnerAccess = await ensureOwnerAccess(interaction, context);
    if (!hasOwnerAccess) {
      return;
    }

    const targetUser = interaction.options.getUser("member", true);
    const reason = interaction.options.getString("reason")?.trim();

    const result = await context.userService.deboard(targetUser.id, reason);

    const messageByStatus: Record<DeboardStatus, string> = {
      deboarded: `<@${targetUser.id}> has been marked as deboarded in the crew registry.`,
      alreadyDeboarded: `<@${targetUser.id}> is already marked as deboarded.`,
      notFound: `No crew profile exists for <@${targetUser.id}> yet.`,
    };

    const toneByStatus: Record<DeboardStatus, EsadelTone> = {
      deboarded: "lavender",
      alreadyDeboarded: "lavender",
      notFound: "rose",
    };

    const labelByStatus: Record<DeboardStatus, string> = {
      deboarded: "Deboarded",
      alreadyDeboarded: "Already deboarded",
      notFound: "Profile not found",
    };

    const fields = [
      {
        name: "Member",
        value: `<@${targetUser.id}>`,
        inline: true,
      },
      {
        name: "Result",
        value: labelByStatus[result.status],
        inline: true,
      },
    ];

    if (result.user?.deboardedAt) {
      const deboardedUnix = Math.floor(result.user.deboardedAt.getTime() / 1000);
      fields.push({
        name: "Deboarded At",
        value: `<t:${deboardedUnix}:f>`,
        inline: true,
      });
    }

    if (result.user?.deboardedMessage) {
      fields.push({
        name: "Deboard Note",
        value: normalizeDeboardMessage(result.user.deboardedMessage).slice(0, 1024),
        inline: false,
      });
    }

    await interaction.reply({
      embeds: [
        createEsadelEmbed({
          title: "Esadel Crew Deboarding",
          description: messageByStatus[result.status],
          tone: toneByStatus[result.status],
          fields,
        }),
      ],
      flags: MessageFlags.Ephemeral,
    });
  }
}
