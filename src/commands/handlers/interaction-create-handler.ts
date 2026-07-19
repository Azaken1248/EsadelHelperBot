import {
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  MessageFlags,
  type Interaction,
} from "discord.js";

import type { Logger } from "../../core/logger/logger";
import { createEsadelEmbed } from "../../presentation/esadel-embed";
import { hasPermissionBypass } from "../../security/permission-bypass";
import type { UserRepository } from "../../repositories/interfaces/user-repository";
import type { CommandExecutionContext } from "../contracts/command-execution-context";
import { CommandRegistry } from "../registry/command-registry";
import type { StrikeAppealHandler } from "./strike-appeal-handler";
import type { SubmitApprovalHandler } from "./submit-approval-handler";

export class InteractionCreateHandler {
  constructor(
    private readonly commandRegistry: CommandRegistry,
    private readonly commandContext: CommandExecutionContext,
    private readonly submitApprovalHandler: SubmitApprovalHandler,
    private readonly strikeAppealHandler: StrikeAppealHandler,
    private readonly userRepository: UserRepository,
    private readonly logger: Logger,
  ) {}

  async handleInteraction(interaction: Interaction): Promise<void> {
    if (interaction.isButton()) {
      await this.handleButtonInteraction(interaction);
      return;
    }

    if (interaction.isAutocomplete()) {
      const command = this.commandRegistry.get(interaction.commandName);
      if (command?.autocomplete) {
        try {
          await command.autocomplete(interaction, this.commandContext);
        } catch (error) {
          this.logger.warn("Autocomplete handler failed.", {
            commandName: interaction.commandName,
            userId: interaction.user.id,
          });
          await interaction.respond([]).catch(() => {});
        }
      }
      return;
    }

    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command = this.commandRegistry.get(interaction.commandName);
    if (!command) {
      await interaction.reply({
        embeds: [
          createEsadelEmbed({
            title: "Esadel Command Desk",
            description: "This command is not available in my current runtime.",
            tone: "lavender",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (command.requiredRoleIds?.length && !hasPermissionBypass(interaction.user.id)) {
      const hasPermission = await this.memberHasAnyRole(interaction, command.requiredRoleIds);
      if (!hasPermission) {
        await interaction.reply({
          embeds: [
            createEsadelEmbed({
              title: "Esadel Access Check",
              description: "You do not have permission to use this command.",
              tone: "twilight",
            }),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    try {
      await command.execute(interaction, this.commandContext);

      // After successful command execution, check for max-strike warning
      await this.sendStrikeWarningIfNeeded(interaction);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected command failure.";

      this.logger.error("Command execution failed.", {
        commandName: interaction.commandName,
        userId: interaction.user.id,
        message,
      });

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          embeds: [
            createEsadelEmbed({
              title: "Esadel Error Report",
              description: `Command failed: ${message}`,
              tone: "twilight",
            }),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.reply({
        embeds: [
          createEsadelEmbed({
            title: "Esadel Error Report",
            description: `Command failed: ${message}`,
            tone: "twilight",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  private async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    if (this.submitApprovalHandler.canHandle(interaction.customId)) {
      try {
        await this.submitApprovalHandler.handle(interaction);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected button handler failure.";
        this.logger.error("Submit approval button handler failed.", {
          customId: interaction.customId,
          userId: interaction.user.id,
          message,
        });

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            embeds: [
              createEsadelEmbed({
                title: "Esadel Error Report",
                description: `Button action failed: ${message}`,
                tone: "twilight",
              }),
            ],
            flags: MessageFlags.Ephemeral,
          });
        }
      }
      return;
    }

    if (this.strikeAppealHandler.canHandle(interaction.customId)) {
      try {
        await this.strikeAppealHandler.handle(interaction);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected button handler failure.";
        this.logger.error("Strike appeal button handler failed.", {
          customId: interaction.customId,
          userId: interaction.user.id,
          message,
        });

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            embeds: [
              createEsadelEmbed({
                title: "Esadel Error Report",
                description: `Button action failed: ${message}`,
                tone: "twilight",
              }),
            ],
            flags: MessageFlags.Ephemeral,
          });
        }
      }
      return;
    }
  }

  private async sendStrikeWarningIfNeeded(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    try {
      const user = await this.userRepository.findByDiscordId(interaction.user.id);
      if (!user || user.strikes < 3) return;

      await interaction.followUp({
        embeds: [
          createEsadelEmbed({
            title: "⚠️ Esadel Strike Warning",
            description: `> <@${interaction.user.id}>, you currently have **3/3 strikes**. This is the maximum — please take this seriously. If you believe a strike is unfair, you can appeal it with \`/appealstrike\`. Let's work together to get things back on track! 🎀`,
            tone: "rose",
            voiceWrap: false,
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    } catch {
      // Warning failures should never break the command flow
    }
  }

  private async memberHasAnyRole(
    interaction: ChatInputCommandInteraction,
    requiredRoleIds: readonly string[],
  ): Promise<boolean> {
    if (!interaction.inGuild() || !interaction.guild) {
      return false;
    }

    try {
      const member = await interaction.guild.members.fetch(interaction.user.id);
      return requiredRoleIds.some((roleId) => member.roles.cache.has(roleId));
    } catch (error) {
      this.logger.warn("Unable to resolve guild member role set.", {
        commandName: interaction.commandName,
        userId: interaction.user.id,
      });
      return false;
    }
  }
}
