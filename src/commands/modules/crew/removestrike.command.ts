import {
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
  type SlashCommandOptionsOnlyBuilder,
} from "discord.js";

import { createEsadelEmbed } from "../../../presentation/esadel-embed";
import type { CommandExecutionContext } from "../../contracts/command-execution-context";
import type { SlashCommand } from "../../contracts/slash-command";
import { ensureOwnerAccess } from "./owner-access";

export class RemoveStrikeCommand implements SlashCommand {
  readonly data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder = new SlashCommandBuilder()
    .setName("removestrike")
    .setDescription("Remove a strike from a crew member. Owners only.")
    .addStringOption((option) =>
      option.setName("strike_id").setDescription("ID of the strike to remove").setRequired(true).setAutocomplete(true),
    )
    .addStringOption((option) =>
      option.setName("reason").setDescription("Reason for removing the strike").setRequired(true),
    );

  async execute(
    interaction: ChatInputCommandInteraction,
    context: CommandExecutionContext,
  ): Promise<void> {
    const hasAccess = await ensureOwnerAccess(interaction, context);
    if (!hasAccess) return;

    const strikeId = interaction.options.getString("strike_id", true);
    const reason = interaction.options.getString("reason", true);

    const result = await context.strikeService.removeStrike(strikeId);

    if (result.status === "strikeNotFound") {
      await interaction.reply({
        embeds: [
          createEsadelEmbed({
            title: "Esadel Strike Board",
            description: `> No strike found with ID \`${strikeId}\`. Double-check the ID and try again!`,
            tone: "lavender",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (result.status === "userNotFound") {
      await interaction.reply({
        embeds: [
          createEsadelEmbed({
            title: "Esadel Strike Board",
            description: "> The user associated with this strike could not be found.",
            tone: "lavender",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        createEsadelEmbed({
          title: "Esadel Strike Board — Strike Removed ✅",
          description: `> Yay~! Strike \`${strikeId}\` was lifted by <@${interaction.user.id}>. Fresh start — let's keep that record looking cute! ♪`,
          tone: "sakura",
          fields: [
            {
              name: "◈ New Strike Count",
              value: `> \`${result.newStrikeCount}/3\``,
              inline: true,
            },
            {
              name: "◈ Removal Reason",
              value: `> ${reason}`,
              inline: false,
            },
          ],
        }),
      ],
      flags: MessageFlags.Ephemeral,
    });

    // Log to the logs channel
    const channelId = context.config.channels.logsChannelId;
    if (channelId) {
      try {
        const channel = await interaction.client.channels.fetch(channelId);
        if (channel && "send" in channel) {
          await (channel as { send: (opts: unknown) => Promise<unknown> }).send({
            embeds: [
              createEsadelEmbed({
                title: "Esadel Strike Log — Strike Removed",
                description: `> <@${interaction.user.id}> removed strike \`${strikeId}\`.`,
                tone: "sakura",
                voiceWrap: false,
                fields: [
                  { name: "◈ Strikes Now", value: `> \`${result.newStrikeCount}/3\``, inline: true },
                  { name: "◈ Reason", value: `> ${reason}`, inline: false },
                ],
              }),
            ],
          });
        }
      } catch {
        // Logging failures should not break the command
      }
    }
  }

  async autocomplete(
    interaction: AutocompleteInteraction,
    context: CommandExecutionContext,
  ): Promise<void> {
    const focused = interaction.options.getFocused();
    const strikes = await context.strikeService.getAllStrikes();

    const { resolveUsernames } = await import("../../../utils/resolve-usernames.js");
    const userIds = strikes.map((s) => s.discordUserId);
    const nameMap = await resolveUsernames(interaction.client, userIds);

    const REASON_LABELS: Record<string, string> = { late: "Late", misc: "Misc" };

    const choices = strikes
      .filter((s) => {
        const username = nameMap.get(s.discordUserId) ?? s.discordUserId;
        const label = `${username} ${s.reason} ${s.id}`;
        return label.toLowerCase().includes(focused.toLowerCase());
      })
      .slice(0, 25)
      .map((s) => {
        const username = nameMap.get(s.discordUserId) ?? s.discordUserId;
        const reasonLabel = REASON_LABELS[s.reason] ?? s.reason;
        const dateStr = s.issuedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        return {
          name: `${username} — ${reasonLabel} (${dateStr})`.slice(0, 100),
          value: s.id as string,
        };
      });

    await interaction.respond(choices);
  }
}
