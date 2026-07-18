import { MessageFlags } from "discord.js";
import { describe, expect, it, vi } from "vitest";

import { HelpCommand } from "../../src/commands/modules/utility/help.command";
import { CommandRegistry } from "../../src/commands/registry/command-registry";
import { createMockCommandContext, createMockInteraction } from "../helpers/mocks";

const createRegistryWithCommands = () => {
  const registry = new CommandRegistry();

  registry.register({
    data: {
      name: "ping",
      description: "Check bot latency.",
      toJSON: () => ({ name: "ping", description: "Check bot latency.", options: [] }),
    },
    execute: vi.fn(),
  } as never);

  registry.register({
    data: {
      name: "assign",
      description: "Assign a task to a crew member.",
      toJSON: () => ({
        name: "assign",
        description: "Assign a task to a crew member.",
        options: [
          { name: "member", description: "Crew member", type: 6, required: true },
          { name: "task", description: "Task name", type: 3, required: true },
          { name: "deadline", description: "Deadline", type: 3, required: true },
          { name: "description", description: "Extra details", type: 3, required: false },
        ],
      }),
    },
    requiredRoleIds: ["owner-role-id", "mod-role-id"],
    execute: vi.fn(),
  } as never);

  return registry;
};

describe("HelpCommand", () => {
  it("shows overview when no command argument is provided", async () => {
    const registry = createRegistryWithCommands();
    const helpCommand = new HelpCommand(registry);
    registry.register(helpCommand as never);

    const interaction = createMockInteraction({
      commandName: "help",
      stringOptions: {},
    });
    const context = createMockCommandContext();

    await helpCommand.execute(interaction as never, context);

    const embed = interaction.reply.mock.calls[0][0].embeds[0].toJSON();
    expect(embed.title).toContain("Help Desk");
    expect(embed.description).toContain("/help");

    expect(embed.fields?.some((f: { name: string; value: string }) =>
      f.value.includes("/ping"),
    )).toBe(true);
    expect(embed.fields?.some((f: { name: string; value: string }) =>
      f.value.includes("/assign"),
    )).toBe(true);
  });

  it("shows command detail when a command name is provided", async () => {
    const registry = createRegistryWithCommands();
    const helpCommand = new HelpCommand(registry);
    registry.register(helpCommand as never);

    const interaction = createMockInteraction({
      commandName: "help",
      stringOptions: { command: "assign" },
    });
    const context = createMockCommandContext();

    await helpCommand.execute(interaction as never, context);

    const embed = interaction.reply.mock.calls[0][0].embeds[0].toJSON();
    expect(embed.title).toContain("/assign");

    expect(embed.fields?.some((f: { name: string; value: string }) =>
      f.name.includes("Access Level") && f.value.includes("Owners & Mods"),
    )).toBe(true);

    expect(embed.fields?.some((f: { name: string; value: string }) =>
      f.name.includes("Parameters") && f.value.includes("member"),
    )).toBe(true);
  });

  it("shows error when unknown command is specified", async () => {
    const registry = createRegistryWithCommands();
    const helpCommand = new HelpCommand(registry);

    const interaction = createMockInteraction({
      commandName: "help",
      stringOptions: { command: "nonexistent" },
    });
    const context = createMockCommandContext();

    await helpCommand.execute(interaction as never, context);

    const embed = interaction.reply.mock.calls[0][0].embeds[0].toJSON();
    expect(embed.description).toContain("don't recognize");
    expect(interaction.reply.mock.calls[0][0].flags).toBe(MessageFlags.Ephemeral);
  });

  it("groups commands by access level", async () => {
    const registry = createRegistryWithCommands();
    const helpCommand = new HelpCommand(registry);
    registry.register(helpCommand as never);

    const interaction = createMockInteraction({
      commandName: "help",
      stringOptions: {},
    });
    const context = createMockCommandContext();

    await helpCommand.execute(interaction as never, context);

    const embed = interaction.reply.mock.calls[0][0].embeds[0].toJSON();

    const everyoneField = embed.fields?.find((f: { name: string }) => f.name.includes("Everyone"));
    expect(everyoneField).toBeDefined();
    expect(everyoneField!.value).toContain("/ping");

    const adminField = embed.fields?.find((f: { name: string }) => f.name.includes("Owners & Mods"));
    expect(adminField).toBeDefined();
    expect(adminField!.value).toContain("/assign");
  });

  it("excludes itself from the overview listing", async () => {
    const registry = createRegistryWithCommands();
    const helpCommand = new HelpCommand(registry);
    registry.register(helpCommand as never);

    const interaction = createMockInteraction({
      commandName: "help",
      stringOptions: {},
    });
    const context = createMockCommandContext();

    await helpCommand.execute(interaction as never, context);

    const embed = interaction.reply.mock.calls[0][0].embeds[0].toJSON();

    const allValues = embed.fields?.map((f: { value: string }) => f.value).join("\n") ?? "";
    expect(allValues).not.toContain("/help");
  });
});
