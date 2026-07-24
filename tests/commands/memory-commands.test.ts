import { describe, expect, it } from "vitest";

import { ForgetMeCommand } from "../../src/commands/modules/amia/forgetme.command";
import { MemoryCommand } from "../../src/commands/modules/amia/memory.command";
import { createMockCommandContext, createMockInteraction } from "../helpers/mocks";

describe("memory commands", () => {
  it("MemoryCommand shows an empty state before anything is learned", async () => {
    const command = new MemoryCommand();
    const interaction = createMockInteraction({ user: { id: "u1" } });

    await command.execute(interaction as never, createMockCommandContext());

    const embed = interaction.reply.mock.calls[0][0].embeds[0].toJSON();
    expect(embed.description).toContain("don't have any memories");
  });

  it("MemoryCommand lists stored memories", async () => {
    const command = new MemoryCommand();
    const interaction = createMockInteraction({ user: { id: "u1" } });
    const context = createMockCommandContext();
    await context.memoryService.remember("u1", [{ text: "Curious about Ena", kind: "interest" }]);

    await command.execute(interaction as never, context);

    const embed = interaction.reply.mock.calls[0][0].embeds[0].toJSON();
    expect(embed.description).toContain("Curious about Ena");
  });

  it("ForgetMeCommand clears the user's memories", async () => {
    const command = new ForgetMeCommand();
    const interaction = createMockInteraction({ user: { id: "u1" } });
    const context = createMockCommandContext();
    await context.memoryService.remember("u1", [{ text: "Curious about Ena", kind: "interest" }]);

    await command.execute(interaction as never, context);

    const embed = interaction.reply.mock.calls[0][0].embeds[0].toJSON();
    expect(embed.description).toContain("forgotten everything");
    expect(await context.memoryService.list("u1")).toHaveLength(0);
  });

  it("ForgetMeCommand handles nothing-to-forget gracefully", async () => {
    const command = new ForgetMeCommand();
    const interaction = createMockInteraction({ user: { id: "fresh" } });

    await command.execute(interaction as never, createMockCommandContext());

    const embed = interaction.reply.mock.calls[0][0].embeds[0].toJSON();
    expect(embed.description).toContain("nothing to forget");
  });
});
