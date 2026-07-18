import { MessageFlags } from "discord.js";
import { describe, expect, it, vi } from "vitest";

import { SubmitCommand } from "../../src/commands/modules/tasks/submit.command";
import { createMockCommandContext, createMockInteraction } from "../helpers/mocks";

describe("SubmitCommand", () => {
  it("replies with error when submitTask returns notFound", async () => {
    const command = new SubmitCommand();
    const interaction = createMockInteraction({
      stringOptions: { assignment_id: "fake-id" },
    });
    const context = createMockCommandContext();

    (context.assignmentService.submitTask as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "notFound",
      reason: "Assignment not found.",
    });

    await command.execute(interaction as never, context);

    expect(context.assignmentService.submitTask).toHaveBeenCalledWith({
      assignmentId: "fake-id",
      discordUserId: "invoking-user-id",
    });

    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.embeds[0].toJSON().description).toContain("Submission Failed");
    expect(payload.flags).toBe(MessageFlags.Ephemeral);
  });

  it("replies with error when submitTask returns notOwner", async () => {
    const command = new SubmitCommand();
    const interaction = createMockInteraction({
      stringOptions: { assignment_id: "assignment-1" },
    });
    const context = createMockCommandContext();

    (context.assignmentService.submitTask as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "notOwner",
      reason: "You can only submit your own assignments.",
    });

    await command.execute(interaction as never, context);

    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.embeds[0].toJSON().description).toContain("Submission Failed");
  });

  it("replies with error when submitTask returns notPending", async () => {
    const command = new SubmitCommand();
    const interaction = createMockInteraction({
      stringOptions: { assignment_id: "assignment-1" },
    });
    const context = createMockCommandContext();

    (context.assignmentService.submitTask as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "notPending",
      reason: "This assignment is currently marked as `COMPLETED`.",
    });

    await command.execute(interaction as never, context);

    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.embeds[0].toJSON().description).toContain("Submission Failed");
  });

  it("posts approval in current channel even when no approval channel is configured", async () => {
    const command = new SubmitCommand();
    const interaction = createMockInteraction({
      stringOptions: { assignment_id: "assignment-1" },
    });
    const context = createMockCommandContext();
    context.config.channels.approvalChannelId = null;

    (context.assignmentService.submitTask as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "submitted",
      assignment: {
        id: "assignment-1",
        taskName: "Draw Card",
        discordUserId: "invoking-user-id",
        deadline: new Date(),
        roleId: "role-artist",
        description: "First draft",
      },
    });

    await command.execute(interaction as never, context);

    expect(interaction.channel.send).toHaveBeenCalledTimes(1);
    const sendPayload = interaction.channel.send.mock.calls[0][0];
    expect(sendPayload.content).toContain(context.config.roles.owners);
    expect(sendPayload.embeds).toBeDefined();
    expect(sendPayload.components).toBeDefined();

    const replyPayload = interaction.reply.mock.calls[0][0];
    expect(replyPayload.embeds[0].toJSON().description).toContain("submitted for review");
    expect(replyPayload.flags).toBe(MessageFlags.Ephemeral);
  });

  it("posts in current channel and cross-posts to approval channel when configured", async () => {
    const command = new SubmitCommand();
    const mockCrossPostSend = vi.fn().mockResolvedValue(undefined);
    const mockFetch = vi.fn().mockResolvedValue({
      isTextBased: () => true,
      send: mockCrossPostSend,
    });

    const interaction = createMockInteraction({
      stringOptions: { assignment_id: "assignment-1" },
    });
    (interaction as unknown as { client: unknown }).client = {
      ...interaction.client,
      channels: { fetch: mockFetch },
    };

    const context = createMockCommandContext();
    context.config.channels.approvalChannelId = "approval-channel-id";

    (context.assignmentService.submitTask as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "submitted",
      assignment: {
        id: "assignment-1",
        taskName: "Draw Card",
        discordUserId: "invoking-user-id",
        deadline: new Date(),
        roleId: "role-artist",
        description: "First draft",
      },
    });

    await command.execute(interaction as never, context);

    expect(interaction.channel.send).toHaveBeenCalledTimes(1);
    const sendPayload = interaction.channel.send.mock.calls[0][0];
    expect(sendPayload.content).toContain(context.config.roles.owners);

    expect(mockFetch).toHaveBeenCalledWith("approval-channel-id");
    expect(mockCrossPostSend).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.any(Array),
        components: expect.any(Array),
      }),
    );

    const replyPayload = interaction.reply.mock.calls[0][0];
    expect(replyPayload.embeds[0].toJSON().description).toContain("submitted for review");
    expect(replyPayload.flags).toBe(MessageFlags.Ephemeral);
  });
});
