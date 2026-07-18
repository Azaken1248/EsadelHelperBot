import { MessageFlags } from "discord.js";
import { describe, expect, it, vi } from "vitest";

import { HiatusCommand } from "../../src/commands/modules/crew/hiatus.command";
import { EndHiatusCommand } from "../../src/commands/modules/crew/endhiatus.command";
import { createMockCommandContext, createMockInteraction } from "../helpers/mocks";

describe("HiatusCommand", () => {
  it("starts hiatus and shows frozen status", async () => {
    const command = new HiatusCommand();
    const interaction = createMockInteraction({
      user: { id: "user-123" },
    });

    const context = createMockCommandContext();
    (context.userService.startHiatus as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "started",
      user: { discordId: "user-123", isOnHiatus: true },
      deadlinesAffected: 0,
    });

    await command.execute(interaction as never, context);

    expect(context.userService.startHiatus).toHaveBeenCalledWith("user-123", undefined);
    expect(interaction.reply).toHaveBeenCalledTimes(1);

    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.flags).toBe(MessageFlags.Ephemeral);

    const embed = payload.embeds[0].toJSON();
    expect(embed.title).toBe("Esadel Hiatus Board");
    expect(embed.description).toContain("hiatus");
    expect(embed.fields?.some((f: { name: string; value: string }) => f.value.includes("ON HIATUS"))).toBe(true);
    expect(embed.fields?.some((f: { name: string; value: string }) => f.value.includes("Frozen"))).toBe(true);
  });

  it("shows already on hiatus message", async () => {
    const command = new HiatusCommand();
    const interaction = createMockInteraction({
      user: { id: "user-123" },
    });

    const context = createMockCommandContext();
    (context.userService.startHiatus as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "alreadyOnHiatus",
      user: { discordId: "user-123", isOnHiatus: true },
      deadlinesAffected: 0,
    });

    await command.execute(interaction as never, context);

    const embed = interaction.reply.mock.calls[0][0].embeds[0].toJSON();
    expect(embed.description).toContain("already on hiatus");
  });

  it("shows not found message for unregistered users", async () => {
    const command = new HiatusCommand();
    const interaction = createMockInteraction({
      user: { id: "unknown-user" },
    });

    const context = createMockCommandContext();
    (context.userService.startHiatus as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "notFound",
      user: null,
      deadlinesAffected: 0,
    });

    await command.execute(interaction as never, context);

    const embed = interaction.reply.mock.calls[0][0].embeds[0].toJSON();
    expect(embed.description).toContain("No crew profile found");
  });

  it("displays reason in embed when provided", async () => {
    const command = new HiatusCommand();
    const interaction = createMockInteraction({
      user: { id: "user-123" },
      stringOptions: { reason: "Going on vacation" },
    });

    const context = createMockCommandContext();
    (context.userService.startHiatus as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "started",
      user: { discordId: "user-123", isOnHiatus: true },
      deadlinesAffected: 0,
    });

    await command.execute(interaction as never, context);

    expect(context.userService.startHiatus).toHaveBeenCalledWith("user-123", "Going on vacation");

    const embed = interaction.reply.mock.calls[0][0].embeds[0].toJSON();
    expect(embed.fields?.some((f: { name: string; value: string }) => f.name === "◈ Reason")).toBe(true);
    expect(embed.fields?.some((f: { name: string; value: string }) => f.value.includes("Going on vacation"))).toBe(true);
  });
});

describe("EndHiatusCommand", () => {
  it("ends hiatus and shows deadlines adjusted count", async () => {
    const command = new EndHiatusCommand();
    const interaction = createMockInteraction({
      user: { id: "user-123" },
    });

    const context = createMockCommandContext();
    (context.userService.endHiatus as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "ended",
      user: { discordId: "user-123", isOnHiatus: false },
      deadlinesAffected: 3,
    });

    await command.execute(interaction as never, context);

    expect(context.userService.endHiatus).toHaveBeenCalledWith("user-123");
    expect(interaction.reply).toHaveBeenCalledTimes(1);

    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.flags).toBe(MessageFlags.Ephemeral);

    const embed = payload.embeds[0].toJSON();
    expect(embed.title).toBe("Esadel Hiatus Board");
    expect(embed.description).toContain("Welcome back");
    expect(embed.fields?.some((f: { name: string; value: string }) => f.value.includes("ACTIVE"))).toBe(true);
    expect(embed.fields?.some((f: { name: string; value: string }) => f.value.includes("3"))).toBe(true);
  });

  it("shows singular 'task' for 1 deadline adjusted", async () => {
    const command = new EndHiatusCommand();
    const interaction = createMockInteraction({
      user: { id: "user-123" },
    });

    const context = createMockCommandContext();
    (context.userService.endHiatus as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "ended",
      user: { discordId: "user-123", isOnHiatus: false },
      deadlinesAffected: 1,
    });

    await command.execute(interaction as never, context);

    const embed = interaction.reply.mock.calls[0][0].embeds[0].toJSON();
    expect(embed.fields?.some((f: { name: string; value: string }) => f.value.includes("task") && !f.value.includes("tasks"))).toBe(true);
  });

  it("shows not on hiatus message", async () => {
    const command = new EndHiatusCommand();
    const interaction = createMockInteraction({
      user: { id: "user-123" },
    });

    const context = createMockCommandContext();
    (context.userService.endHiatus as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "notOnHiatus",
      user: { discordId: "user-123", isOnHiatus: false },
      deadlinesAffected: 0,
    });

    await command.execute(interaction as never, context);

    const embed = interaction.reply.mock.calls[0][0].embeds[0].toJSON();
    expect(embed.description).toContain("not currently on hiatus");
  });
});
