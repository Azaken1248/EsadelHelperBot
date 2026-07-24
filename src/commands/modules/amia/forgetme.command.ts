import {
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
  type SlashCommandOptionsOnlyBuilder,
} from "discord.js";

import { createEsadelEmbed } from "../../../presentation/esadel-embed";
import type { CommandExecutionContext } from "../../contracts/command-execution-context";
import type { SlashCommand } from "../../contracts/slash-command";

export class ForgetMeCommand implements SlashCommand {
  readonly data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder = new SlashCommandBuilder()
    .setName("forgetme")
    .setDescription("Make Amia forget everything she remembers about you.");

  async execute(
    interaction: ChatInputCommandInteraction,
    context: CommandExecutionContext,
  ): Promise<void> {
    const removed = await context.memoryService.forget(interaction.user.id);

    const description =
      removed > 0
        ? `> Poof~! I've forgotten everything about you (${removed} memor${removed === 1 ? "y" : "ies"}). Fresh start — nice to meet you again! ♡`
        : "> There was nothing to forget~ I don't have any memories of you yet. ♪";

    await interaction.reply({
      embeds: [
        createEsadelEmbed({
          title: "Amia's Memory 🎀",
          description,
          tone: "lavender",
          voiceWrap: false,
        }),
      ],
      flags: MessageFlags.Ephemeral,
    });
  }
}
