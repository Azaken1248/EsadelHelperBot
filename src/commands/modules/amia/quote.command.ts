import {
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
  type SlashCommandOptionsOnlyBuilder,
} from "discord.js";

import { createEsadelEmbed } from "../../../presentation/esadel-embed";
import type { CommandExecutionContext } from "../../contracts/command-execution-context";
import type { SlashCommand } from "../../contracts/slash-command";

export class QuoteCommand implements SlashCommand {
  readonly data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder = new SlashCommandBuilder()
    .setName("quote")
    .setDescription("Get a random Mizuki / 25-ji Nightcord quote.");

  async execute(
    interaction: ChatInputCommandInteraction,
    context: CommandExecutionContext,
  ): Promise<void> {
    const quote = context.knowledgeService.randomQuote();

    await interaction.reply({
      embeds: [
        createEsadelEmbed({
          title: "Amia Quote ♪",
          description: `> *"${quote.text}"*\n> — ${quote.attribution}`,
          tone: "lavender",
          voiceWrap: false,
        }),
      ],
    });
  }
}
