import {
  type ButtonInteraction,
  type GuildMember,
  MessageFlags,
} from "discord.js";

import type { AppConfig } from "../../config/env";
import type { Logger } from "../../core/logger/logger";
import { createEsadelEmbed } from "../../presentation/esadel-embed";
import { hasPermissionBypass } from "../../security/permission-bypass";
import { reactSafely } from "../../utils/reactions";
import type { AssignmentService } from "../../services/assignment-service";

const SUBMIT_APPROVE_PREFIX = "submit_approve:";
const SUBMIT_DENY_PREFIX = "submit_deny:";

export class SubmitApprovalHandler {
  constructor(
    private readonly assignmentService: AssignmentService,
    private readonly config: AppConfig,
    private readonly logger: Logger,
  ) {}

  canHandle(customId: string): boolean {
    return customId.startsWith(SUBMIT_APPROVE_PREFIX) || customId.startsWith(SUBMIT_DENY_PREFIX);
  }

  async handle(interaction: ButtonInteraction): Promise<void> {
    const customId = interaction.customId;
    const isApproval = customId.startsWith(SUBMIT_APPROVE_PREFIX);
    const assignmentId = isApproval
      ? customId.slice(SUBMIT_APPROVE_PREFIX.length)
      : customId.slice(SUBMIT_DENY_PREFIX.length);

    if (!assignmentId) {
      await interaction.reply({
        embeds: [
          createEsadelEmbed({
            title: "Esadel Submission Desk",
            description: "> Could not determine the assignment from this button.",
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
            description: "> Only owners and mods can review submissions.",
            tone: "twilight",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (isApproval) {
      await this.handleApproval(interaction, assignmentId);
    } else {
      await this.handleDenial(interaction, assignmentId);
    }
  }

  private async handleApproval(
    interaction: ButtonInteraction,
    assignmentId: string,
  ): Promise<void> {
    const updated = await this.assignmentService.approveTask(assignmentId);

    if (!updated) {
      await interaction.reply({
        embeds: [
          createEsadelEmbed({
            title: "Esadel Submission Desk",
            description: "> Could not approve this task. It may have already been processed or removed.",
            tone: "twilight",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const approvedEmbed = createEsadelEmbed({
      title: "Esadel Submission Desk — Approved ✅",
      description: `> Task **${updated.taskName}** submitted by <@${updated.discordUserId}> has been **approved** by <@${interaction.user.id}>!`,
      tone: "sakura",
      voiceWrap: false,
      fields: [
        {
          name: "◈ Status",
          value: "> `COMPLETED`",
          inline: true,
        },
        {
          name: "◈ Reviewed By",
          value: `> <@${interaction.user.id}>`,
          inline: true,
        },
        {
          name: "◈ Assignment ID",
          value: `> \`${assignmentId}\``,
          inline: false,
        },
      ],
    });

    await interaction.update({
      embeds: [approvedEmbed],
      components: [],
    });
    await reactSafely(interaction.message, ["🎀", "✨"]);

    this.logger.info("Submission approved via button.", {
      assignmentId,
      reviewerId: interaction.user.id,
    });
  }

  private async handleDenial(
    interaction: ButtonInteraction,
    assignmentId: string,
  ): Promise<void> {
    const deniedEmbed = createEsadelEmbed({
      title: "Esadel Submission Desk — Denied ❌",
      description: `> The submission for assignment \`${assignmentId}\` has been **denied** by <@${interaction.user.id}>. The task remains **PENDING** so the member can redo and resubmit.`,
      tone: "lavender",
      voiceWrap: false,
      fields: [
        {
          name: "◈ Status",
          value: "> `PENDING` (unchanged)",
          inline: true,
        },
        {
          name: "◈ Reviewed By",
          value: `> <@${interaction.user.id}>`,
          inline: true,
        },
        {
          name: "◈ Assignment ID",
          value: `> \`${assignmentId}\``,
          inline: false,
        },
      ],
    });

    await interaction.update({
      embeds: [deniedEmbed],
      components: [],
    });
    await reactSafely(interaction.message, ["💭"]);

    this.logger.info("Submission denied via button.", {
      assignmentId,
      reviewerId: interaction.user.id,
    });
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
      this.logger.warn("Unable to verify reviewer access for submission button.", {
        userId: interaction.user.id,
        message,
      });
      return false;
    }
  }
}
