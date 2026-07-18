import {
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
  type SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";

import { createEsadelEmbed } from "../../../presentation/esadel-embed";
import { searchTimezones } from "../../../utils/iana-timezones";
import type { CommandExecutionContext } from "../../contracts/command-execution-context";
import type { SlashCommand } from "../../contracts/slash-command";

export class TimezoneCommand implements SlashCommand {
  readonly data: SlashCommandSubcommandsOnlyBuilder = new SlashCommandBuilder()
    .setName("timezone")
    .setDescription("Set or view your timezone so deadlines show in your local time.")
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Set your timezone.")
        .addStringOption((option) =>
          option
            .setName("timezone")
            .setDescription('Your IANA timezone, e.g. "America/New_York"')
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("view").setDescription("View your current timezone preference."),
    );

  async execute(
    interaction: ChatInputCommandInteraction,
    context: CommandExecutionContext,
  ): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "set") {
      await this.handleSet(interaction, context);
      return;
    }

    await this.handleView(interaction, context);
  }

  private async handleSet(
    interaction: ChatInputCommandInteraction,
    context: CommandExecutionContext,
  ): Promise<void> {
    const timezone = interaction.options.getString("timezone", true).trim();

    if (!context.timezoneService.isValidTimezone(timezone)) {
      await interaction.reply({
        embeds: [
          createEsadelEmbed({
            title: "Esadel Timezone",
            description: `> Hmm, \`${timezone}\` doesn't look like a valid IANA timezone~ Try picking one from the suggestions, like \`America/New_York\`.`,
            tone: "rose",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const result = await context.userService.setTimezone(interaction.user.id, timezone);

    if (result.status === "notFound") {
      await interaction.reply({
        embeds: [
          createEsadelEmbed({
            title: "Esadel Timezone",
            description: "> I couldn't find your crew profile yet. Ask an owner to onboard you first, okay? ♡",
            tone: "lavender",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const sampleNow = context.timezoneService.formatDeadline(new Date(), timezone);

    await interaction.reply({
      embeds: [
        createEsadelEmbed({
          title: "Esadel Timezone",
          description: `> Timezone updated to \`${timezone}\`! Now your deadlines will show in your local time — no more math! Hehe~`,
          tone: "sakura",
          voiceWrap: false,
          fields: [
            {
              name: "◈ Your local time now",
              value: `> ${sampleNow}`,
              inline: false,
            },
          ],
        }),
      ],
      flags: MessageFlags.Ephemeral,
    });
  }

  private async handleView(
    interaction: ChatInputCommandInteraction,
    context: CommandExecutionContext,
  ): Promise<void> {
    const result = await context.userService.getTimezone(interaction.user.id);

    if (result.status === "notFound") {
      await interaction.reply({
        embeds: [
          createEsadelEmbed({
            title: "Esadel Timezone",
            description: "> I couldn't find your crew profile yet. Ask an owner to onboard you first, okay? ♡",
            tone: "lavender",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!result.timezone) {
      await interaction.reply({
        embeds: [
          createEsadelEmbed({
            title: "Esadel Timezone",
            description: "> You haven't set a timezone yet~ Use `/timezone set` and I'll show your deadlines in local time! ♪",
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
          title: "Esadel Timezone",
          description: `> Your current timezone preference is set to \`${result.timezone}\`~ Let me know if you need to adjust it! ♡`,
          tone: "lavender",
          voiceWrap: false,
        }),
      ],
      flags: MessageFlags.Ephemeral,
    });
  }

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focused = interaction.options.getFocused();
    const choices = searchTimezones(focused).map((zone) => ({
      name: zone.slice(0, 100),
      value: zone,
    }));

    await interaction.respond(choices);
  }
}
