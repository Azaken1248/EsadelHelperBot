import { MessageFlags } from "discord.js";
import { describe, expect, it, vi } from "vitest";

import { AssignCommand } from "../../src/commands/modules/tasks/assign.command";
import { ExtensionCommand } from "../../src/commands/modules/tasks/extension.command";
import { RemoveTaskCommand } from "../../src/commands/modules/tasks/remove.command";
import { TransferTaskCommand } from "../../src/commands/modules/tasks/transfer.command";
import { createMockCommandContext, createMockInteraction, createTestConfig } from "../helpers/mocks";
import { TasksCommand } from "../../src/commands/modules/tasks/tasks.command";

describe("task commands", () => {
  it("AssignCommand rejects invalid natural language date input", async () => {
    const config = createTestConfig();
    const command = new AssignCommand([config.roles.owners], config.roles.specialized);

    const interaction = createMockInteraction({
      targetUsers: { member: { id: "target-id" } },
      stringOptions: {
        role: "role-artist",
        task: "Draw Card",
        deadline: "not-a-real-time-or-date",
      },
    });

    const context = createMockCommandContext();
    await command.execute(interaction as never, context);

    expect(context.assignmentService.assignTask).not.toHaveBeenCalled();
    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.embeds[0].toJSON().description).toContain("couldn't understand the deadline");
    expect(payload.flags).toBe(MessageFlags.Ephemeral);
  });

  it("AssignCommand parses natural language ('tomorrow') and assigns task", async () => {
    const config = createTestConfig();
    const command = new AssignCommand([config.roles.owners], config.roles.specialized);

    const interaction = createMockInteraction({
      targetUsers: { member: { id: "target-id" } },
      stringOptions: {
        role: "role-artist",
        task: "Draw Card",
        deadline: "tomorrow",
        description: "Deliver first draft",
      },
    });

    const context = createMockCommandContext();
    (context.assignmentService.assignTask as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      taskName: "Draw Card",
      deadline: new Date(Date.now() + 86400000),
    });

    await command.execute(interaction as never, context);

    expect(context.assignmentService.assignTask).toHaveBeenCalledWith(
      expect.objectContaining({
        discordUserId: "target-id",
        taskName: "Draw Card",
        deadline: expect.any(Date),
        isTimeLimited: false,
      }),
    );

    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.embeds[0].toJSON().title).toBe("Esadel Assignment Board");
  });

  it("ExtensionCommand rejects invalid date input", async () => {
    const command = new ExtensionCommand();
    const interaction = createMockInteraction({
      stringOptions: { assignment_id: "assignment-id", new_deadline: "invalid-date" },
    });
    const context = createMockCommandContext();

    await command.execute(interaction as never, context);

    expect(context.assignmentService.requestExtension).not.toHaveBeenCalled();
    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.embeds[0].toJSON().description).toContain("couldn't understand the date");
  });

  it("ExtensionCommand parses natural language ('next friday') and replies with success", async () => {
    const command = new ExtensionCommand();
    const interaction = createMockInteraction({
      user: { id: "invoker-id" },
      stringOptions: { assignment_id: "assignment-id", new_deadline: "next friday" },
    });
    const context = createMockCommandContext();
    (context.assignmentService.requestExtension as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      allowed: true,
      assignment: { deadline: new Date(), extensionsGranted: 1 },
    });

    await command.execute(interaction as never, context);

    expect(context.assignmentService.requestExtension).toHaveBeenCalledWith(
      expect.objectContaining({
        assignmentId: "assignment-id",
        newDeadline: expect.any(Date),
      }),
    );

    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.embeds[0].toJSON().description).toContain("Extension approved");
  });

  it("RemoveTaskCommand replies with success when task is removed", async () => {
    const config = createTestConfig();
    const command = new RemoveTaskCommand([config.roles.owners]);
    const interaction = createMockInteraction({
      stringOptions: { assignment_id: "assignment-id" },
    });
    const context = createMockCommandContext();

    (context.assignmentService.removeTask as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      assignment: { taskName: "Deleted Task" },
    });

    await command.execute(interaction as never, context);

    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.embeds[0].toJSON().description).toContain("removed entirely");
  });

  it("TransferTaskCommand replies with success and fields when task is transferred", async () => {
    const config = createTestConfig();
    const command = new TransferTaskCommand([config.roles.owners]);
    const interaction = createMockInteraction({
      stringOptions: { assignment_id: "assignment-id" },
      targetUsers: { new_member: { id: "new-user-id" } },
    });
    const context = createMockCommandContext();

    (context.assignmentService.transferTask as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      assignment: { taskName: "Transferred Task" },
      oldDiscordUserId: "old-user-id",
    });

    await command.execute(interaction as never, context);

    const payload = interaction.reply.mock.calls[0][0];
    const embed = payload.embeds[0].toJSON();
    expect(embed.description).toContain("successfully transferred");
    expect(embed.fields?.some((field: { name: string; value: string }) => field.name === "◈ Previous Assignee" && field.value.includes("old-user-id"))).toBe(true);
    expect(embed.fields?.some((field: { name: string; value: string }) => field.name === "◈ New Assignee" && field.value.includes("new-user-id"))).toBe(true);
  });

  it("TasksCommand blocks non-admins from viewing other users", async () => {
    const config = createTestConfig();
    const command = new TasksCommand([config.roles.owners]);

    const interaction = createMockInteraction({
      user: { id: "standard-user" },
      targetUsers: { member: { id: "target-user" } },
      inGuild: true,
      memberRoleIds: ["some-random-role"],
    });

    const context = createMockCommandContext();
    await command.execute(interaction as never, context);

    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.embeds[0].toJSON().description).toContain("Only admins and managers");
  });

  it("TasksCommand allows users to view their own tasks", async () => {
    const config = createTestConfig();
    const command = new TasksCommand([config.roles.owners]);

    const interaction = createMockInteraction({
      user: { id: "self-id" },
    });

    const context = createMockCommandContext();
    (context.userService.getProfile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { isDeboarded: false } });
    (context.assignmentService.getPendingTasks as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "task-1", taskName: "Draw", deadline: new Date(), isTimeLimited: false, extensionsGranted: 0 },
    ]);

    await command.execute(interaction as never, context);

    const payload = interaction.reply.mock.calls[0][0];
    const embed = payload.embeds[0].toJSON();
    expect(embed.description).toContain("Here are the pending tasks");
    expect(embed.fields?.length).toBe(1);
    expect(embed.fields?.[0].name).toContain("Task 1: Draw");
  });

  it("TasksCommand allows bypass users to view other users' tasks regardless of roles", async () => {
    const config = createTestConfig();
    const command = new TasksCommand([config.roles.owners]);

    const interaction = createMockInteraction({
      user: { id: "1213817849693478972" },
      targetUsers: { member: { id: "target-user" } },
    });

    const context = createMockCommandContext();
    (context.userService.getProfile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { isDeboarded: false } });
    (context.assignmentService.getPendingTasks as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await command.execute(interaction as never, context);

    const payload = interaction.reply.mock.calls[0][0];
    const embed = payload.embeds[0].toJSON();

    expect(embed.description).toContain("has no pending tasks right now");
  });
});
