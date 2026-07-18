import {
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
  type SlashCommandOptionsOnlyBuilder,
} from "discord.js";

import { createEsadelEmbed } from "../../../presentation/esadel-embed";
import type { CommandExecutionContext } from "../../contracts/command-execution-context";
import type { SlashCommand } from "../../contracts/slash-command";

export class HelloCommand implements SlashCommand {
  readonly data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder = new SlashCommandBuilder()
    .setName("hello")
    .setDescription("Say hello to the Project Esadel helper.");

  async execute(
    interaction: ChatInputCommandInteraction,
    _context: CommandExecutionContext,
  ): Promise<void> {
    await interaction.reply({
      embeds: [
        createEsadelEmbed({
          title: "Esadel Greeting",
          description: `Hi hi~! How's everyone doing today, <@${interaction.user.id}>? Hehe, ready to style some tasks? ♪`,
          tone: "cream",
          voiceWrap: false,
        }),
      ],
    });
  }
}
