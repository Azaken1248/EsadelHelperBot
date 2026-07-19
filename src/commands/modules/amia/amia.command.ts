import {
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
  type SlashCommandOptionsOnlyBuilder,
} from "discord.js";

import { AMIA_TAGLINE } from "../../../knowledge/mizuki-knowledge";
import { CATEGORY_LABELS } from "../../../knowledge/mizuki-knowledge";
import { createEsadelEmbed } from "../../../presentation/esadel-embed";
import type { CommandExecutionContext } from "../../contracts/command-execution-context";
import type { SlashCommand } from "../../contracts/slash-command";

export class AmiaCommand implements SlashCommand {
  readonly data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder = new SlashCommandBuilder()
    .setName("amia")
    .setDescription("Learn about Amia, or browse the lore by topic.")
    .addStringOption((option) =>
      option
        .setName("topic")
        .setDescription("A topic to look up (leave empty for an overview)")
        .setRequired(false)
        .setAutocomplete(true),
    );

  async execute(
    interaction: ChatInputCommandInteraction,
    context: CommandExecutionContext,
  ): Promise<void> {
    const topic = interaction.options.getString("topic");

    if (topic) {
      const entry =
        context.knowledgeService.getById(topic) ??
        context.knowledgeService.searchTopics(topic, 1)[0];

      if (!entry) {
        await interaction.reply({
          embeds: [
            createEsadelEmbed({
              title: "Amia",
              description: `Hmm~ I couldn't find anything about \`${topic}\`. Try picking one from the suggestions! ♡`,
              tone: "lavender",
              voiceWrap: false,
            }),
          ],
        });
        return;
      }

      await interaction.reply({
        embeds: [
          createEsadelEmbed({
            title: `Amia — ${entry.title}`,
            description: entry.content,
            tone: "sakura",
            voiceWrap: false,
            fields: [
              {
                name: "◈ Category",
                value: `\`${CATEGORY_LABELS[entry.category]}\``,
                inline: true,
              },
            ],
          }),
        ],
      });
      return;
    }

    const categories = context.knowledgeService.listCategories();
    const fields = categories.map((summary) => ({
      name: `◈ ${summary.label}`,
      value: `> ${summary.count} topic${summary.count === 1 ? "" : "s"}`,
      inline: true,
    }));

    await interaction.reply({
      embeds: [
        createEsadelEmbed({
          title: "About Amia ♡",
          description:
            `Hi hi~! I'm **Amia** — that's my handle over in 25-ji, Nightcord de.! ♪\n\n` +
            `My whole thing? *"${AMIA_TAGLINE}"* Hehe~\n\n` +
            "Ask me anything with `/ask`, pull up a topic with `/amia topic:`, or try `/fact` and `/quote`!",
          tone: "sakura",
          voiceWrap: false,
          fields,
        }),
      ],
    });
  }

  async autocomplete(interaction: AutocompleteInteraction, context: CommandExecutionContext): Promise<void> {
    const focused = interaction.options.getFocused();
    const topics = context.knowledgeService.searchTopics(focused);

    await interaction.respond(
      topics.map((entry) => ({
        name: entry.title.slice(0, 100),
        value: entry.id,
      })),
    );
  }
}
