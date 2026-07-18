import {
  type ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";

import { createEsadelEmbed } from "../../../presentation/esadel-embed";
import { hasPermissionBypass } from "../../../security/permission-bypass";
import type { CommandExecutionContext } from "../../contracts/command-execution-context";

export const ensureOwnerAccess = async (
  interaction: ChatInputCommandInteraction,
  context: CommandExecutionContext,
): Promise<boolean> => {
  if (!interaction.inGuild() || !interaction.guild || !interaction.guildId) {
    await interaction.reply({
      embeds: [
        createEsadelEmbed({
          title: "Esadel Access Check",
          description: "This command is only available inside a server.",
          tone: "lavender",
        }),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }

  if (hasPermissionBypass(interaction.user.id)) {
    return true;
  }

  let ownerRoleIds: string[] = [];

  try {
    const cachedConfig = context.configCacheService.getConfig(interaction.guildId);
    ownerRoleIds = cachedConfig.ownerRoleIds;
  } catch {
    const loadedConfig = await context.configCacheService.loadConfig(interaction.guildId);
    ownerRoleIds = loadedConfig.ownerRoleIds;
  }

  if (ownerRoleIds.length === 0) {
    await interaction.reply({
      embeds: [
        createEsadelEmbed({
          title: "Esadel Access Check",
          description:
            "No owner roles are configured for this server yet. Ask an owner to configure access roles first.",
          tone: "rose",
        }),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }

  try {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const hasOwnerRole = ownerRoleIds.some((roleId) => member.roles.cache.has(roleId));

    if (hasOwnerRole) {
      return true;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown role resolution failure.";

    context.logger.warn("Unable to verify owner access for command.", {
      commandName: interaction.commandName,
      userId: interaction.user.id,
      message,
    });

    await interaction.reply({
      embeds: [
        createEsadelEmbed({
          title: "Esadel Access Check",
          description:
            "I could not verify your role permissions right now. Please try again in a moment.",
          tone: "twilight",
        }),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }

  await interaction.reply({
    embeds: [
      createEsadelEmbed({
        title: "Esadel Access Check",
        description: "This command is owner-only.",
        tone: "twilight",
      }),
    ],
    flags: MessageFlags.Ephemeral,
  });

  return false;
};
