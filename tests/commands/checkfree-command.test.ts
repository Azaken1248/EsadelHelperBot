import { MessageFlags } from "discord.js";
import { describe, expect, it, vi } from "vitest";

import { CheckFreeCommand } from "../../src/commands/modules/utility/checkfree.command";
import { createMockCommandContext, createMockInteraction } from "../helpers/mocks";

describe("CheckFreeCommand", () => {
  it("shows message when everyone has tasks", async () => {
    const command = new CheckFreeCommand();
    const interaction = createMockInteraction({});
    const context = createMockCommandContext();

    (context.userService.getAvailableMembers as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      active: [],
      hiatus: [],
    });

    await command.execute(interaction as never, context);

    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.embeds[0].toJSON().description).toContain("Everyone has tasks right now");
    expect(payload.embeds[0].toJSON().title).toBe("Esadel Availability Board");
    expect(payload.flags).toBe(MessageFlags.Ephemeral);
  });

  it("shows active free members", async () => {
    const command = new CheckFreeCommand();
    const interaction = createMockInteraction({});
    const context = createMockCommandContext();

    (context.userService.getAvailableMembers as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      active: [
        { discordId: "user-1", username: "Alice" },
        { discordId: "user-2", username: "Bob" },
      ],
      hiatus: [],
    });

    await command.execute(interaction as never, context);

    const payload = interaction.reply.mock.calls[0][0];
    const embed = payload.embeds[0].toJSON();
    expect(embed.description).toContain("2");
    expect(embed.fields?.length).toBe(1);
    expect(embed.fields?.[0].name).toContain("Available & Active");
    expect(embed.fields?.[0].value).toContain("user-1");
    expect(embed.fields?.[0].value).toContain("user-2");
  });

  it("shows hiatus free members separately", async () => {
    const command = new CheckFreeCommand();
    const interaction = createMockInteraction({});
    const context = createMockCommandContext();

    (context.userService.getAvailableMembers as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      active: [{ discordId: "user-1", username: "Alice" }],
      hiatus: [{ discordId: "user-3", username: "Carol" }],
    });

    await command.execute(interaction as never, context);

    const payload = interaction.reply.mock.calls[0][0];
    const embed = payload.embeds[0].toJSON();
    expect(embed.description).toContain("2");
    expect(embed.fields?.length).toBe(2);
    expect(embed.fields?.[0].name).toContain("Available & Active");
    expect(embed.fields?.[1].name).toContain("On Hiatus");
    expect(embed.fields?.[1].value).toContain("user-3");
  });

  it("shows only hiatus section when no active free members exist", async () => {
    const command = new CheckFreeCommand();
    const interaction = createMockInteraction({});
    const context = createMockCommandContext();

    (context.userService.getAvailableMembers as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      active: [],
      hiatus: [{ discordId: "user-4", username: "Dave" }],
    });

    await command.execute(interaction as never, context);

    const payload = interaction.reply.mock.calls[0][0];
    const embed = payload.embeds[0].toJSON();
    expect(embed.fields?.length).toBe(1);
    expect(embed.fields?.[0].name).toContain("On Hiatus");
  });
});
