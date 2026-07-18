import { MessageFlags } from "discord.js";
import { describe, expect, it, vi } from "vitest";

import { HistoryCommand } from "../../src/commands/modules/utility/history.command";
import { createMockCommandContext, createMockInteraction, createTestConfig } from "../helpers/mocks";

describe("HistoryCommand", () => {
  const config = createTestConfig();

  it("shows empty state when no records match", async () => {
    const command = new HistoryCommand([config.roles.owners], config.roles.specialized);
    const interaction = createMockInteraction({});
    const context = createMockCommandContext();

    (context.assignmentService.getHistory as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await command.execute(interaction as never, context);

    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.embeds[0].toJSON().description).toContain("No task records found");
    expect(payload.flags).toBe(MessageFlags.Ephemeral);
  });

  it("displays assignments with correct fields on success", async () => {
    const command = new HistoryCommand([config.roles.owners], config.roles.specialized);
    const interaction = createMockInteraction({});
    const context = createMockCommandContext();

    (context.assignmentService.getHistory as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "task-1",
        taskName: "Draw Card",
        status: "COMPLETED",
        roleId: "role-artist",
        deadline: new Date(),
      },
      {
        id: "task-2",
        taskName: "Edit Video",
        status: "PENDING",
        roleId: "role-editor",
        deadline: new Date(),
      },
    ]);

    await command.execute(interaction as never, context);

    const payload = interaction.reply.mock.calls[0][0];
    const embed = payload.embeds[0].toJSON();
    expect(embed.title).toBe("Esadel History Archive");
    expect(embed.description).toContain("task history");
    expect(embed.description).toContain("2");
    expect(embed.fields?.length).toBe(2);
    expect(embed.fields?.[0].name).toContain("Draw Card");
    expect(embed.fields?.[0].value).toContain("COMPLETED");
    expect(embed.fields?.[1].name).toContain("Edit Video");
  });

  it("passes status filter to getHistory", async () => {
    const command = new HistoryCommand([config.roles.owners], config.roles.specialized);
    const interaction = createMockInteraction({
      stringOptions: { status: "COMPLETED" },
    });
    const context = createMockCommandContext();

    (context.assignmentService.getHistory as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await command.execute(interaction as never, context);

    expect(context.assignmentService.getHistory).toHaveBeenCalledWith(
      "invoking-user-id",
      expect.objectContaining({ status: "COMPLETED" }),
    );
  });

  it("passes role filter to getHistory", async () => {
    const command = new HistoryCommand([config.roles.owners], config.roles.specialized);
    const interaction = createMockInteraction({
      stringOptions: { role: "role-artist" },
    });
    const context = createMockCommandContext();

    (context.assignmentService.getHistory as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await command.execute(interaction as never, context);

    expect(context.assignmentService.getHistory).toHaveBeenCalledWith(
      "invoking-user-id",
      expect.objectContaining({ roleId: "role-artist" }),
    );
  });

  it("passes task name search filter to getHistory", async () => {
    const command = new HistoryCommand([config.roles.owners], config.roles.specialized);
    const interaction = createMockInteraction({
      stringOptions: { search: "card" },
    });
    const context = createMockCommandContext();

    (context.assignmentService.getHistory as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await command.execute(interaction as never, context);

    expect(context.assignmentService.getHistory).toHaveBeenCalledWith(
      "invoking-user-id",
      expect.objectContaining({ taskName: "card" }),
    );
  });

  it("shows filter summary in empty state message", async () => {
    const command = new HistoryCommand([config.roles.owners], config.roles.specialized);
    const interaction = createMockInteraction({
      stringOptions: { status: "LATE", search: "card" },
    });
    const context = createMockCommandContext();

    (context.assignmentService.getHistory as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await command.execute(interaction as never, context);

    const payload = interaction.reply.mock.calls[0][0];
    const desc = payload.embeds[0].toJSON().description;
    expect(desc).toContain("LATE");
    expect(desc).toContain("card");
  });

  it("uses target user when member option is specified", async () => {
    const command = new HistoryCommand([config.roles.owners], config.roles.specialized);
    const interaction = createMockInteraction({
      targetUsers: { member: { id: "other-user-id" } },
    });
    const context = createMockCommandContext();

    (context.assignmentService.getHistory as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await command.execute(interaction as never, context);

    expect(context.assignmentService.getHistory).toHaveBeenCalledWith(
      "other-user-id",
      expect.any(Object),
    );
  });
});
