import {
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
  type SlashCommandOptionsOnlyBuilder,
} from "discord.js";

import { SPECIALIZED_ROLE_LABELS, type SpecializedRoleKey } from "../../../config/constants";
import { createEsadelEmbed, type EsadelTone } from "../../../presentation/esadel-embed";
import type { CommandExecutionContext } from "../../contracts/command-execution-context";
import type { SlashCommand } from "../../contracts/slash-command";

const normalizeDeboardMessage = (message: string): string => {
  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return "No farewell note was recorded.";
  }

  if (/different\s+sekai/i.test(trimmed)) {
    return "Moved to a different team.";
  }

  return trimmed;
};

export class ProfileCommand implements SlashCommand {
  readonly data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder = new SlashCommandBuilder()
    .setName("profile")
    .setDescription("View a crew profile and assignment statistics.")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User to inspect (defaults to yourself)")
        .setRequired(false),
    );

  async execute(
    interaction: ChatInputCommandInteraction,
    context: CommandExecutionContext,
  ): Promise<void> {
    const targetUser = interaction.options.getUser("user") ?? interaction.user;
    const profile = await context.userService.getProfile(targetUser.id);

    if (!profile) {
      await interaction.reply({
        embeds: [
          createEsadelEmbed({
            title: "Esadel Profile Board",
            description: `> I could not find a crew profile for <@${targetUser.id}> yet. Ask an owner to onboard them first.`,
            tone: "lavender",
          }),
        ],
      });
      return;
    }

    const joinedUnix = Math.floor(profile.user.joinedAt.getTime() / 1000);
    const deboardedUnix = profile.user.deboardedAt
      ? Math.floor(profile.user.deboardedAt.getTime() / 1000)
      : null;
    const statusText = profile.user.isDeboarded ? "Deboarded" : profile.user.isOnHiatus ? "On Hiatus" : "Active";
    const isMaxStrikes = profile.user.strikes >= 3;
    const tone: EsadelTone = isMaxStrikes
      ? "rose"
      : profile.user.isDeboarded
        ? "lavender"
        : profile.user.isOnHiatus
          ? "lavender"
          : "sakura";
    const hiatusText = profile.user.isOnHiatus ? "❄️ ON HIATUS" : "No ";
    const strikeText = isMaxStrikes ? `⚠️ ${profile.user.strikes}/3` : `${profile.user.strikes}/3`;

    const assignedRoles: string[] = [];

    if (interaction.inGuild() && interaction.guild) {
      try {
        const member = await interaction.guild.members.fetch(targetUser.id);

        if (member.roles.cache.has(context.config.roles.owners)) {
          assignedRoles.push("Owner");
        }
        if (member.roles.cache.has(context.config.roles.mods)) {
          assignedRoles.push("Manager");
        }

        const specializedEntries = Object.entries(context.config.roles.specialized) as [
          SpecializedRoleKey,
          string,
        ][];
        for (const [key, roleId] of specializedEntries) {
          if (member.roles.cache.has(roleId)) {
            assignedRoles.push(SPECIALIZED_ROLE_LABELS[key]);
          }
        }
      } catch {
      }
    }

    const rolesText = assignedRoles.length > 0 ? assignedRoles.join(", ") : "Standard Crew";

    const embed = createEsadelEmbed({
      title: "Esadel Profile Board",
      description: `Here is the latest profile snapshot for <@${targetUser.id}>.`,
      tone,
      voiceWrap: false,
      fields: [
        {
          name: "◈ Crew Identity",
          value: `> **Member:** <@${targetUser.id}>\n> **Joined:** <t:${joinedUnix}:D> (<t:${joinedUnix}:R>)`,
          inline: true,
        },
        {
          name: "◈ Roster Status",
          value: `> **Status:** \` ${statusText} \`\n> **Roles:** \` ${rolesText} \`\n> **Hiatus:** \` ${hiatusText} \`\n> **Strikes:** \` ${strikeText} \``,
          inline: true,
        },
        {
          name: "◈ Assignment Record",
          value: "```yaml\n" +
            `Total     : ${profile.assignmentStats.total}\n` +
            `Pending   : ${profile.assignmentStats.pending}\n` +
            `Completed : ${profile.assignmentStats.completed}\n` +
            `Late      : ${profile.assignmentStats.late}\n` +
            `Excused   : ${profile.assignmentStats.excused}\n` +
            "```",
          inline: false,
        },
      ],
    });

    if (deboardedUnix !== null) {
      embed.addFields({
        name: "◈ Deboarded At",
        value: `> <t:${deboardedUnix}:f>`,
        inline: true,
      });
      embed.addFields({
        name: "◈ Deboard Note",
        value: `> ${normalizeDeboardMessage(profile.user.deboardedMessage).slice(0, 1024)}`,
        inline: false,
      });
    }

    if (profile.user.isOnHiatus) {
      const hiatusFields: { name: string; value: string; inline: boolean }[] = [];

      if (profile.user.hiatusStartedAt) {
        const hiatusUnix = Math.floor(profile.user.hiatusStartedAt.getTime() / 1000);
        hiatusFields.push({
          name: "◈ Hiatus Since",
          value: `> <t:${hiatusUnix}:D> (<t:${hiatusUnix}:R>)`,
          inline: true,
        });
      }

      if (profile.user.hiatusReason) {
        hiatusFields.push({
          name: "◈ Hiatus Reason",
          value: `> ${profile.user.hiatusReason.slice(0, 1024)}`,
          inline: false,
        });
      }

      if (hiatusFields.length > 0) {
        embed.addFields(...hiatusFields);
      }
    }

    if (isMaxStrikes) {
      embed.addFields({
        name: "◈ ⚠️ Maximum Strikes",
        value: "> This member has reached the maximum number of strikes. If you believe a strike is unfair, use `/appealstrike` to request a review.",
        inline: false,
      });
    }

    embed.setThumbnail(targetUser.displayAvatarURL({ size: 256 }));

    await interaction.reply({
      embeds: [embed],
    });
  }
}
