import {
  type ChatInputCommandInteraction,
  type GuildMember,
  MessageFlags,
  SlashCommandBuilder,
  type SlashCommandOptionsOnlyBuilder,
} from "discord.js";

import { createEsadelEmbed } from "../../../presentation/esadel-embed";
import { hasPermissionBypass } from "../../../security/permission-bypass";
import type { CommandExecutionContext } from "../../contracts/command-execution-context";
import type { SlashCommand } from "../../contracts/slash-command";

export class TasksCommand implements SlashCommand {
  readonly data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  private readonly adminRoleIds: readonly string[];

  constructor(adminRoleIds: readonly string[]) {
    this.adminRoleIds = adminRoleIds;
    this.data = new SlashCommandBuilder()
      .setName("tasks")
      .setDescription("View your pending tasks, or check another crew member's tasks (Admins only).")
      .addUserOption((option) =>
        option
          .setName("member")
          .setDescription("Crew member to inspect (Admins only)")
          .setRequired(false),
      );
  }

  async execute(
    interaction: ChatInputCommandInteraction,
    context: CommandExecutionContext,
  ): Promise<void> {
    const targetUser = interaction.options.getUser("member");
    const queryUser = targetUser ?? interaction.user;
    const isSelf = queryUser.id === interaction.user.id;

    if (!isSelf) {
      let hasAdminAccess = hasPermissionBypass(interaction.user.id);

      if (!hasAdminAccess && interaction.member && "roles" in interaction.member) {
        const member = interaction.member as GuildMember;
        hasAdminAccess = this.adminRoleIds.some((roleId) => member.roles.cache.has(roleId));
      }

      if (!hasAdminAccess) {
        await interaction.reply({
          embeds: [
            createEsadelEmbed({
              title: "Esadel Assignment Board",
              description: "> Ah, hold on~ 🛑 Only admins and managers can peek at other crew members' task boards! We wouldn't want to mess up anyone's styling, right? ♡",
              tone: "twilight",
            }),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    const profile = await context.userService.getProfile(queryUser.id);
    if (!profile || profile.user.isDeboarded) {
      await interaction.reply({
        embeds: [
          createEsadelEmbed({
            title: "Esadel Assignment Board",
            description: `> <@${queryUser.id}> is not currently an active, onboarded crew member.`,
            tone: "lavender",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const tasks = await context.assignmentService.getPendingTasks(queryUser.id);

    if (tasks.length === 0) {
      const msg = isSelf
        ? "> You have no pending tasks right now~! All caught up — go treat yourself, hehe~ ✨"
        : `> <@${queryUser.id}> has no pending tasks right now~ all clear! ♪`;

      await interaction.reply({
        embeds: [
          createEsadelEmbed({
            title: "Esadel Assignment Board",
            description: msg,
            tone: "sakura",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const fields = tasks.slice(0, 25).map((task, index) => {
      const unixDeadline = Math.floor(task.deadline.getTime() / 1000);
      const status = task.isTimeLimited ? "🛑 Strict" : "✨ Flexible";

      return {
        name: `◈ Task ${index + 1}: ${task.taskName}`,
        value: `> **Deadline:** <t:${unixDeadline}:F> (<t:${unixDeadline}:R>)\n> **Status:** \`${status}\` | **Extensions:** \`${task.extensionsGranted}\`\n> **ID:** \`${task.id}\``,
        inline: false,
      };
    });

    await interaction.reply({
      embeds: [
        createEsadelEmbed({
          title: "Esadel Assignment Board",
          description: `> Here are the pending tasks for <@${queryUser.id}>~ Let's tackle them and go do something fun after, okay? ♪`,
          tone: "lavender",
          fields,
        }),
      ],
      flags: MessageFlags.Ephemeral,
    });
  }
}
