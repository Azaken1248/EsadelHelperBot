import {
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
  type SlashCommandOptionsOnlyBuilder,
} from "discord.js";

import { createEsadelEmbed } from "../../../presentation/esadel-embed";
import type { CommandExecutionContext } from "../../contracts/command-execution-context";
import type { SlashCommand } from "../../contracts/slash-command";

interface EmbedField {
  name: string;
  value: string;
  inline: boolean;
}

export class CheckFreeCommand implements SlashCommand {
  readonly data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder = new SlashCommandBuilder()
    .setName("checkfree")
    .setDescription("See which crew members currently have zero pending tasks.");

  async execute(
    interaction: ChatInputCommandInteraction,
    context: CommandExecutionContext,
  ): Promise<void> {
    const { active, hiatus } = await context.userService.getAvailableMembers();

    if (active.length === 0 && hiatus.length === 0) {
      await interaction.reply({
        embeds: [
          createEsadelEmbed({
            title: "Esadel Availability Board",
            description: "> Everyone has tasks right now! The whole crew is in full momentum — love to see it! ♪",
            tone: "sakura",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const fields: EmbedField[] = [];

    if (active.length > 0) {
      const activeList = active
        .map((user) => `> • <@${user.discordId}>`)
        .join("\n");

      fields.push({
        name: `◈ Available & Active (${active.length})`,
        value: activeList,
        inline: false,
      });
    }

    if (hiatus.length > 0) {
      const hiatusList = hiatus
        .map((user) => `> • <@${user.discordId}> *(on hiatus)*`)
        .join("\n");

      fields.push({
        name: `◈ Available but On Hiatus (${hiatus.length})`,
        value: hiatusList,
        inline: false,
      });
    }

    const totalFree = active.length + hiatus.length;

    await interaction.reply({
      embeds: [
        createEsadelEmbed({
          title: "Esadel Availability Board",
          description: `> **${totalFree}** crew member${totalFree !== 1 ? "s" : ""} currently ${totalFree !== 1 ? "have" : "has"} no pending tasks. Ready for the next spotlight! ♪`,
          tone: "lavender",
          fields,
        }),
      ],
      flags: MessageFlags.Ephemeral,
    });
  }
}
