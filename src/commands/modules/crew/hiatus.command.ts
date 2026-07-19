import {
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
  type SlashCommandOptionsOnlyBuilder,
} from "discord.js";

import { createEsadelEmbed, type EsadelTone } from "../../../presentation/esadel-embed";
import type { CommandExecutionContext } from "../../contracts/command-execution-context";
import type { SlashCommand } from "../../contracts/slash-command";
import type { HiatusStatus } from "../../../services/user-service";

export class HiatusCommand implements SlashCommand {
  readonly data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder = new SlashCommandBuilder()
    .setName("hiatus")
    .setDescription("Go on hiatus — your pending task deadlines will be frozen until you return.")
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Why you're going on hiatus (optional)")
        .setRequired(false),
    );

  async execute(
    interaction: ChatInputCommandInteraction,
    context: CommandExecutionContext,
  ): Promise<void> {
    const reason = interaction.options.getString("reason") ?? undefined;
    const result = await context.userService.startHiatus(interaction.user.id, reason);

    const messages: Record<HiatusStatus, string> = {
      started: `> Got it~! <@${interaction.user.id}> is on hiatus now. Take a good rest and go do something fun — I'll keep your deadlines completely frozen so you don't have to worry at all! ♪`,
      alreadyOnHiatus: `> <@${interaction.user.id}> is already on hiatus~ Use \`/endhiatus\` whenever you're ready to come back, okay? ♡`,
      notFound: `> No crew profile found for <@${interaction.user.id}>. You need to be onboarded first~`,
      deboarded: `> Aw, <@${interaction.user.id}> has been deboarded and can't go on hiatus.`,
      ended: "> Unexpected state.",
      notOnHiatus: "> Unexpected state.",
    };

    const toneByStatus: Record<HiatusStatus, EsadelTone> = {
      started: "lavender",
      alreadyOnHiatus: "lavender",
      notFound: "rose",
      deboarded: "rose",
      ended: "lavender",
      notOnHiatus: "lavender",
    };

    const fields =
      result.status === "started"
        ? [
            {
              name: "◈ Status",
              value: "> `ON HIATUS`",
              inline: true,
            },
            {
              name: "◈ Deadlines",
              value: "> Frozen ❄️",
              inline: true,
            },
            ...(reason
              ? [
                  {
                    name: "◈ Reason",
                    value: `> ${reason}`,
                    inline: false,
                  },
                ]
              : []),
          ]
        : [];

    await interaction.reply({
      embeds: [
        createEsadelEmbed({
          title: "Esadel Hiatus Board",
          description: messages[result.status],
          tone: toneByStatus[result.status],
          fields,
        }),
      ],
      flags: MessageFlags.Ephemeral,
    });
  }
}
