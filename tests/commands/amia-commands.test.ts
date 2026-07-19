import { describe, expect, it } from "vitest";

import { AmiaCommand } from "../../src/commands/modules/amia/amia.command";
import { AskCommand } from "../../src/commands/modules/amia/ask.command";
import { FactCommand } from "../../src/commands/modules/amia/fact.command";
import { QuoteCommand } from "../../src/commands/modules/amia/quote.command";
import { createMockCommandContext, createMockInteraction } from "../helpers/mocks";

describe("amia commands", () => {
  it("AskCommand answers a known question from the knowledge base", async () => {
    const command = new AskCommand();
    const interaction = createMockInteraction({
      stringOptions: { question: "who is Ena?" },
    });

    await command.execute(interaction as never, createMockCommandContext());

    const embed = interaction.reply.mock.calls[0][0].embeds[0].toJSON();
    expect(embed.title).toContain("Amia —");
    expect(embed.description.toLowerCase()).toContain("ena");
  });

  it("AskCommand replies gracefully when nothing matches", async () => {
    const command = new AskCommand();
    const interaction = createMockInteraction({
      stringOptions: { question: "quarterly tax filing spreadsheet" },
    });

    await command.execute(interaction as never, createMockCommandContext());

    const embed = interaction.reply.mock.calls[0][0].embeds[0].toJSON();
    expect(embed.description).toContain("don't think I have anything on that");
  });

  it("AmiaCommand shows an overview with category fields when no topic is given", async () => {
    const command = new AmiaCommand();
    const interaction = createMockInteraction({ stringOptions: {} });

    await command.execute(interaction as never, createMockCommandContext());

    const embed = interaction.reply.mock.calls[0][0].embeds[0].toJSON();
    expect(embed.title).toContain("About Amia");
    expect(embed.fields?.length).toBeGreaterThan(0);
  });

  it("AmiaCommand shows a specific topic by id", async () => {
    const command = new AmiaCommand();
    const interaction = createMockInteraction({ stringOptions: { topic: "songs" } });

    await command.execute(interaction as never, createMockCommandContext());

    const embed = interaction.reply.mock.calls[0][0].embeds[0].toJSON();
    expect(embed.title).toContain("Focus songs");
  });

  it("FactCommand replies with a fact embed", async () => {
    const command = new FactCommand();
    const interaction = createMockInteraction();

    await command.execute(interaction as never, createMockCommandContext());

    const embed = interaction.reply.mock.calls[0][0].embeds[0].toJSON();
    expect(embed.title).toContain("Fun Fact");
    expect(embed.description.length).toBeGreaterThan(1);
  });

  it("QuoteCommand replies with a quote embed", async () => {
    const command = new QuoteCommand();
    const interaction = createMockInteraction();

    await command.execute(interaction as never, createMockCommandContext());

    const embed = interaction.reply.mock.calls[0][0].embeds[0].toJSON();
    expect(embed.title).toContain("Quote");
    expect(embed.description).toContain("—");
  });
});
