import { describe, expect, it, vi } from "vitest";

import { TimeCommand } from "../../src/commands/modules/utility/time.command";
import { createMockCommandContext, createMockInteraction } from "../helpers/mocks";

describe("TimeCommand", () => {
  it("shows the caller's local time when a timezone is set", async () => {
    const command = new TimeCommand();
    const interaction = createMockInteraction({ user: { id: "user-1" } });
    const context = createMockCommandContext();

    (context.userService.getTimezone as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "found",
      timezone: "America/New_York",
    });
    (context.timezoneService.formatDeadline as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      "Jul 19, 2026, 11:30 PM EDT",
    );

    await command.execute(interaction as never, context);

    const embed = interaction.reply.mock.calls[0][0].embeds[0].toJSON();
    expect(embed.description).toContain("Jul 19, 2026, 11:30 PM EDT");
    expect(embed.description).toContain("for you right now");
    expect(embed.fields?.some((f: { value: string }) => f.value.includes("America/New_York"))).toBe(true);
  });

  it("prompts to set a timezone when none is stored", async () => {
    const command = new TimeCommand();
    const interaction = createMockInteraction({ user: { id: "user-1" } });
    const context = createMockCommandContext();

    (context.userService.getTimezone as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "found",
      timezone: null,
    });

    await command.execute(interaction as never, context);

    const embed = interaction.reply.mock.calls[0][0].embeds[0].toJSON();
    expect(embed.description).toContain("/timezone set");
  });

  it("reports when the profile does not exist", async () => {
    const command = new TimeCommand();
    const interaction = createMockInteraction({ user: { id: "user-1" } });
    const context = createMockCommandContext();

    (context.userService.getTimezone as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "notFound",
      timezone: null,
    });

    await command.execute(interaction as never, context);

    const embed = interaction.reply.mock.calls[0][0].embeds[0].toJSON();
    expect(embed.description).toContain("crew profile");
  });
});
