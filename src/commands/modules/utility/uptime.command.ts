import {
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
  type SlashCommandOptionsOnlyBuilder,
} from "discord.js";

import { createEsadelEmbed } from "../../../presentation/esadel-embed";
import type { CommandExecutionContext } from "../../contracts/command-execution-context";
import type { SlashCommand } from "../../contracts/slash-command";

const formatUptime = (totalSeconds: number): string => {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const units: string[] = [];

  if (days > 0) {
    units.push(`${days}d`);
  }

  if (hours > 0 || days > 0) {
    units.push(`${hours}h`);
  }

  if (minutes > 0 || hours > 0 || days > 0) {
    units.push(`${minutes}m`);
  }

  units.push(`${seconds}s`);

  return units.join(" ");
};

export class UptimeCommand implements SlashCommand {
  readonly data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder = new SlashCommandBuilder()
    .setName("uptime")
    .setDescription("Show how long the bot has been online.");

  async execute(
    interaction: ChatInputCommandInteraction,
    _context: CommandExecutionContext,
  ): Promise<void> {
    const uptimeSeconds = Math.floor(process.uptime());

    await interaction.reply({
      embeds: [
        createEsadelEmbed({
          title: "Esadel Runtime Status",
          description: `I've been awake for **${formatUptime(uptimeSeconds)}** now! Still active and cute as ever~ ♪`,
          tone: "lavender",
          voiceWrap: false,
        }),
      ],
    });
  }
}
