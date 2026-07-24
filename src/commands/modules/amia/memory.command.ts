import {
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
  type SlashCommandOptionsOnlyBuilder,
} from "discord.js";

import { createEsadelEmbed } from "../../../presentation/esadel-embed";
import type { CommandExecutionContext } from "../../contracts/command-execution-context";
import type { SlashCommand } from "../../contracts/slash-command";

const KIND_LABEL: Record<string, string> = {
  interest: "🎀 Interest",
  preference: "⚙️ Preference",
  fact: "📌 Fact",
  style: "🎶 Style",
};

export class MemoryCommand implements SlashCommand {
  readonly data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder = new SlashCommandBuilder()
    .setName("memory")
    .setDescription("See what Amia remembers about you (use /forgetme to clear it).");

  async execute(
    interaction: ChatInputCommandInteraction,
    context: CommandExecutionContext,
  ): Promise<void> {
    const memories = await context.memoryService.list(interaction.user.id);

    if (memories.length === 0) {
      await interaction.reply({
        embeds: [
          createEsadelEmbed({
            title: "Amia's Memory 🎀",
            description:
              "> I don't have any memories of you yet~ Chat with me (try `/ask`) and I'll start to remember what you like! ♡",
            tone: "lavender",
            voiceWrap: false,
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const lines = memories
      .slice(0, 15)
      .map((memory) => `> ${KIND_LABEL[memory.kind] ?? memory.kind} — ${memory.text}`)
      .join("\n");

    await interaction.reply({
      embeds: [
        createEsadelEmbed({
          title: "Amia's Memory 🎀",
          description: `> Here's what I remember about you~ ♪\n${lines}`,
          tone: "sakura",
          voiceWrap: false,
          fields: [
            {
              name: "◈ Your control",
              value: "> Want a clean slate? Use `/forgetme` and I'll forget it all. ♡",
              inline: false,
            },
          ],
        }),
      ],
      flags: MessageFlags.Ephemeral,
    });
  }
}
