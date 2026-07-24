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
    .setDescription("Ask Amia about herself, 25-ji Nightcord, or the lore (not a general chatbot~).")
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

    // A local LLM answer can take a few seconds — ack first, then edit.
    await interaction.deferReply();

    const answer = await context.ragService.ask(question, interaction.user.id);

    if (!answer) {
      await interaction.editReply({
        embeds: [
          createEsadelEmbed({
            title: "Amia",
            description:
              "Hmm~ that's a little outside what I know! I mostly keep to myself, 25-ji Nightcord, " +
              "and the story — like `who is Ena?` or `what does Amia mean?`. " +
              "Browse everything with `/amia`, okay? ♡",
            tone: "lavender",
            voiceWrap: false,
          }),
        ],
      });
      return;
    }

    const fields =
      answer.sources.length > 0
        ? [
            {
              name: "◈ Sources",
              value: answer.sources
                .slice(0, 4)
                .map((entry) => `\`${entry.title}\``)
                .join(" · "),
              inline: false,
            },
          ]
        : [];

    await interaction.editReply({
      embeds: [
        createEsadelEmbed({
          title: "Amia",
          description: answer.text,
          tone: "sakura",
          voiceWrap: false,
          fields,
        }),
      ],
    });
  }
}
