import {
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
  type SlashCommandOptionsOnlyBuilder,
} from "discord.js";

import { createEsadelEmbed } from "../../../presentation/esadel-embed";
import type { CommandExecutionContext } from "../../contracts/command-execution-context";
import type { SlashCommand } from "../../contracts/slash-command";

export class FactCommand implements SlashCommand {
  readonly data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder = new SlashCommandBuilder()
    .setName("fact")
    .setDescription("Get a random Amia / 25-ji Nightcord fun fact.");

  async execute(
    interaction: ChatInputCommandInteraction,
    context: CommandExecutionContext,
  ): Promise<void> {
    const fact = context.knowledgeService.randomFact();

    await interaction.reply({
      embeds: [
        createEsadelEmbed({
          title: "Amia Fun Fact 🍬",
          description: `> ${fact}`,
          tone: "cream",
          voiceWrap: false,
        }),
      ],
    });
  }
}
