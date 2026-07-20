import {
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
  type SlashCommandOptionsOnlyBuilder,
} from "discord.js";

import { createEsadelEmbed } from "../../../presentation/esadel-embed";
import type { CommandExecutionContext } from "../../contracts/command-execution-context";
import type { SlashCommand } from "../../contracts/slash-command";

export class TimeCommand implements SlashCommand {
  readonly data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder = new SlashCommandBuilder()
    .setName("time")
    .setDescription("Show your current local time (uses your saved /timezone).")
    .addUserOption((option) =>
      option
        .setName("member")
        .setDescription("Whose local time to show (defaults to you)")
        .setRequired(false),
    );

  async execute(
    interaction: ChatInputCommandInteraction,
    context: CommandExecutionContext,
  ): Promise<void> {
    const targetUser = interaction.options.getUser("member") ?? interaction.user;
    const isSelf = targetUser.id === interaction.user.id;

    const result = await context.userService.getTimezone(targetUser.id);

    if (result.status === "notFound") {
      await interaction.reply({
        embeds: [
          createEsadelEmbed({
            title: "Esadel Time",
            description: isSelf
              ? "> I couldn't find your crew profile yet~ Ask an owner to onboard you first, okay? ♡"
              : `> There's no crew profile for <@${targetUser.id}> yet~`,
            tone: "lavender",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!result.timezone) {
      await interaction.reply({
        embeds: [
          createEsadelEmbed({
            title: "Esadel Time",
            description: isSelf
              ? "> You haven't set a timezone yet~ Use `/timezone set` and I'll show your local time, hehe~ ♪"
              : `> <@${targetUser.id}> hasn't set a timezone yet~ They can use \`/timezone set\`!`,
            tone: "lavender",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const localTime = context.timezoneService.formatDeadline(new Date(), result.timezone);

    await interaction.reply({
      embeds: [
        createEsadelEmbed({
          title: "Esadel Time 🕒",
          description: isSelf
            ? `> It's **${localTime}** for you right now~ ♪`
            : `> It's **${localTime}** for <@${targetUser.id}> right now~ ♪`,
          tone: "cream",
          voiceWrap: false,
          fields: [
            {
              name: "◈ Timezone",
              value: `> \`${result.timezone}\``,
              inline: true,
            },
          ],
        }),
      ],
      flags: MessageFlags.Ephemeral,
    });
  }
}
