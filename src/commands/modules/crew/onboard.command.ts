import {
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
  type SlashCommandOptionsOnlyBuilder,
} from "discord.js";

import { createEsadelEmbed, type EsadelTone } from "../../../presentation/esadel-embed";
import type { CommandExecutionContext } from "../../contracts/command-execution-context";
import type { SlashCommand } from "../../contracts/slash-command";
import type { OnboardStatus } from "../../../services/user-service";
import { ensureOwnerAccess } from "./owner-access";

export class OnboardCommand implements SlashCommand {
  readonly data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder = new SlashCommandBuilder()
    .setName("onboard")
    .setDescription("Onboard a member as active crew in the bot database. Owners only.")
    .addUserOption((option) =>
      option.setName("member").setDescription("Member to onboard").setRequired(true),
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
    const result = await context.userService.onboard(targetUser.id, targetUser.username);
    const joinedUnix = Math.floor(result.user.joinedAt.getTime() / 1000);

    const messages: Record<OnboardStatus, string> = {
      created: `Hi hi~! <@${targetUser.id}> is officially part of the crew now! Let's make some amazing work together, okay? ♪`,
      reactivated: `Welcome back~! <@${targetUser.id}> is active in the crew registry again. So glad to have you! ♡`,
      alreadyActive: `Oh, look~ <@${targetUser.id}> is already part of the team! No need to register them twice, hehe~`,
    };

    const toneByStatus: Record<OnboardStatus, EsadelTone> = {
      created: "sakura",
      reactivated: "lavender",
      alreadyActive: "lavender",
    };

    const labelByStatus: Record<OnboardStatus, string> = {
      created: "New profile created",
      reactivated: "Reactivated",
      alreadyActive: "Already active",
    };

    await interaction.reply({
      embeds: [
        createEsadelEmbed({
          title: "Esadel Crew Onboarding",
          description: messages[result.status],
          tone: toneByStatus[result.status],
          fields: [
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
            {
              name: "Joined",
              value: `<t:${joinedUnix}:f>`,
              inline: true,
            },
          ],
        }),
      ],
      flags: MessageFlags.Ephemeral,
    });
  }
}
