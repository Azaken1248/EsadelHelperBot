import {
  type ButtonInteraction,
  type GuildMember,
  MessageFlags,
} from "discord.js";

import type { AppConfig } from "../../config/env";
import type { Logger } from "../../core/logger/logger";
import { createEsadelEmbed, type EsadelTone } from "../../presentation/esadel-embed";
import { hasPermissionBypass } from "../../security/permission-bypass";
import { reactSafely } from "../../utils/reactions";
import type { StrikeService } from "../../services/strike-service";

const APPEAL_ACCEPT_PREFIX = "appeal_accept:";
const APPEAL_DENY_PREFIX = "appeal_deny:";

export class StrikeAppealHandler {
  constructor(
    private readonly strikeService: StrikeService,
    private readonly config: AppConfig,
    private readonly logger: Logger,
  ) {}

  canHandle(customId: string): boolean {
    return customId.startsWith(APPEAL_ACCEPT_PREFIX) || customId.startsWith(APPEAL_DENY_PREFIX);
  }

  async handle(interaction: ButtonInteraction): Promise<void> {
    const customId = interaction.customId;
    const isAccept = customId.startsWith(APPEAL_ACCEPT_PREFIX);
    const strikeId = isAccept
      ? customId.slice(APPEAL_ACCEPT_PREFIX.length)
      : customId.slice(APPEAL_DENY_PREFIX.length);

    if (!strikeId) {
      await interaction.reply({
        embeds: [
          createEsadelEmbed({
            title: "Esadel Appeal Desk",
            description: "> Could not determine the strike from this button.",
            tone: "twilight",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const hasAccess = await this.verifyReviewerAccess(interaction);
    if (!hasAccess) {
      await interaction.reply({
        embeds: [
          createEsadelEmbed({
            title: "Esadel Access Check",
            description: "> Only owners and mods can review strike appeals.",
            tone: "twilight",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const result = await this.strikeService.resolveAppeal(strikeId, interaction.user.id, isAccept);

    if (result.status === "strikeNotFound") {
      await interaction.reply({
        embeds: [
          createEsadelEmbed({
            title: "Esadel Appeal Desk",
            description: "> This strike no longer exists. It may have already been removed.",
            tone: "lavender",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (result.status === "notPending") {
      await interaction.reply({
        embeds: [
          createEsadelEmbed({
            title: "Esadel Appeal Desk",
            description: "> This appeal has already been resolved.",
            tone: "lavender",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (result.status === "accepted") {
      const acceptedEmbed = createEsadelEmbed({
        title: "Esadel Appeal Desk — Accepted ✅",
        description: `> The appeal for strike \`${strikeId}\` has been **accepted** by <@${interaction.user.id}>. The strike has been removed!`,
        tone: "sakura",
        voiceWrap: false,
        fields: [
          {
            name: "◈ Reviewed By",
            value: `> <@${interaction.user.id}>`,
            inline: true,
          },
          {
            name: "◈ New Strike Count",
            value: `> \`${result.newStrikeCount}/3\``,
            inline: true,
          },
        ],
      });

      await interaction.update({
        embeds: [acceptedEmbed],
        components: [],
      });
      await reactSafely(interaction.message, ["🎀", "✨"]);

      await this.logToChannel(interaction, `Appeal for strike \`${strikeId}\` **accepted** by <@${interaction.user.id}>. Strike removed.`, "sakura", result.newStrikeCount);
      return;
    }

    // Denied
    const deniedEmbed = createEsadelEmbed({
      title: "Esadel Appeal Desk — Denied ❌",
      description: `> The appeal for strike \`${strikeId}\` has been **denied** by <@${interaction.user.id}>. The strike stands.`,
      tone: "lavender",
      voiceWrap: false,
      fields: [
        {
          name: "◈ Reviewed By",
          value: `> <@${interaction.user.id}>`,
          inline: true,
        },
        {
          name: "◈ Strike Count",
          value: `> \`${result.newStrikeCount}/3\``,
          inline: true,
        },
      ],
    });

    await interaction.update({
      embeds: [deniedEmbed],
      components: [],
    });
    await reactSafely(interaction.message, ["💭"]);

    await this.logToChannel(interaction, `Appeal for strike \`${strikeId}\` **denied** by <@${interaction.user.id}>.`, "lavender", result.newStrikeCount);
  }

  private async logToChannel(
    interaction: ButtonInteraction,
    description: string,
    tone: EsadelTone,
    strikeCount: number,
  ): Promise<void> {
    const channelId = this.config.channels.logsChannelId;
    if (!channelId) return;

    try {
      const channel = await interaction.client.channels.fetch(channelId);
      if (!channel || !("send" in channel)) return;

      await (channel as { send: (opts: unknown) => Promise<unknown> }).send({
        embeds: [
          createEsadelEmbed({
            title: "Esadel Strike Log — Appeal Resolved",
            description: `> ${description}`,
            tone,
            voiceWrap: false,
            fields: [
              { name: "◈ Strikes", value: `> \`${strikeCount}/3\``, inline: true },
            ],
          }),
        ],
      });
    } catch {
      // Logging failures should not break the handler
    }
  }

  private async verifyReviewerAccess(interaction: ButtonInteraction): Promise<boolean> {
    if (hasPermissionBypass(interaction.user.id)) {
      return true;
    }

    if (!interaction.inGuild() || !interaction.guild) {
      return false;
    }

    const adminRoleIds = [this.config.roles.owners, this.config.roles.mods];

    try {
      const member = await interaction.guild.members.fetch(interaction.user.id) as GuildMember;
      return adminRoleIds.some((roleId) => member.roles.cache.has(roleId));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown role resolution failure.";
      this.logger.warn("Unable to verify reviewer access for appeal button.", {
        userId: interaction.user.id,
        message,
      });
      return false;
    }
  }
}
