import {
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
  type SlashCommandOptionsOnlyBuilder,
} from "discord.js";

import { createEsadelEmbed } from "../../../presentation/esadel-embed";
import type { CommandExecutionContext } from "../../contracts/command-execution-context";
import type { SlashCommand } from "../../contracts/slash-command";

export class AskCommand implements SlashCommand {
  readonly data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder = new SlashCommandBuilder()
    .setName("ask")
    .setDescription("Ask Amia about herself, 25-ji Nightcord, or the lore.")
    .addStringOption((option) =>
      option
        .setName("question")
        .setDescription("What do you want to know? (e.g. 'who is Ena?', 'what does Amia mean?')")
        .setRequired(true),
    );

  async execute(
    interaction: ChatInputCommandInteraction,
    context: CommandExecutionContext,
  ): Promise<void> {
    const question = interaction.options.getString("question", true);
    const { best, related } = context.knowledgeService.answer(question);

    if (!best) {
      await interaction.reply({
        embeds: [
          createEsadelEmbed({
            title: "Amia",
            description:
              "Hmm~ I don't think I have anything on that yet! Try `/amia` to see what I *do* know, okay? Hehe~ ♡",
            tone: "lavender",
            voiceWrap: false,
          }),
        ],
      });
      return;
    }

    const fields =
      related.length > 0
        ? [
            {
              name: "◈ See also",
              value: related.map((entry) => `\`${entry.title}\``).join(" · "),
              inline: false,
            },
          ]
        : [];

    await interaction.reply({
      embeds: [
        createEsadelEmbed({
          title: `Amia — ${best.title}`,
          description: `> Ooh, good question~! ♪\n\n${best.content}`,
          tone: "sakura",
          voiceWrap: false,
          fields,
        }),
      ],
    });
  }
}
