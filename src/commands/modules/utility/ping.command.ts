import {
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
  type SlashCommandOptionsOnlyBuilder,
} from "discord.js";

import { createEsadelEmbed } from "../../../presentation/esadel-embed";
import type { CommandExecutionContext } from "../../contracts/command-execution-context";
import type { SlashCommand } from "../../contracts/slash-command";

export class PingCommand implements SlashCommand {
  readonly data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder = new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check the bot and Discord API latency.");

  async execute(
    interaction: ChatInputCommandInteraction,
    _context: CommandExecutionContext,
  ): Promise<void> {
    const roundTripLatencyMs = Date.now() - interaction.createdTimestamp;
    const apiLatencyMs = interaction.client.ws.ping;

    await interaction.reply({
      embeds: [
        createEsadelEmbed({
          title: "Esadel Ping Check",
          description: "Pong~! Everything is running super smoothly on my end! Hehe~",
          tone: "lavender",
          voiceWrap: false,
          fields: [
            {
              name: "Round-trip",
              value: `${roundTripLatencyMs}ms`,
              inline: true,
            },
            {
              name: "Discord API",
              value: `${apiLatencyMs}ms`,
              inline: true,
            },
          ],
        }),
      ],
    });
  }
}
