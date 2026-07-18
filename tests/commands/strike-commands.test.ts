import { MessageFlags } from "discord.js";
import { describe, expect, it, vi } from "vitest";

import { StrikeCommand } from "../../src/commands/modules/crew/strike.command";
import { RemoveStrikeCommand } from "../../src/commands/modules/crew/removestrike.command";
import { AppealStrikeCommand } from "../../src/commands/modules/crew/appealstrike.command";
import { createMockCommandContext, createMockInteraction } from "../helpers/mocks";

describe("StrikeCommand", () => {
  it("issues a strike and replies with count", async () => {
    const command = new StrikeCommand();
    const interaction = createMockInteraction({
      user: { id: "1213817849693478972" },
      targetUsers: { member: { id: "target-user" } },
      stringOptions: { reason: "late", detail: "May 5th" },
      inGuild: true,
      memberRoleIds: ["owner-role-id"],
    });
    (interaction as Record<string, unknown>).client = {
      ...interaction.client,
      channels: { fetch: vi.fn().mockResolvedValue(null) },
    };

    const context = createMockCommandContext();
    (context.strikeService.addStrike as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "added",
      strike: { id: "strike-1" },
      newStrikeCount: 2,
    });

    await command.execute(interaction as never, context);

    expect(context.strikeService.addStrike).toHaveBeenCalledWith("target-user", "1213817849693478972", "late", "May 5th");
    expect(interaction.reply).toHaveBeenCalledTimes(1);

    const embed = interaction.reply.mock.calls[0][0].embeds[0].toJSON();
    expect(embed.title).toContain("Strike Issued");
    expect(embed.fields?.some((f: { name: string; value: string }) => f.value.includes("2/3"))).toBe(true);
  });

  it("shows max-strike warning when user hits 3", async () => {
    const command = new StrikeCommand();
    const interaction = createMockInteraction({
      user: { id: "1213817849693478972" },
      targetUsers: { member: { id: "target-user" } },
      stringOptions: { reason: "misc" },
      inGuild: true,
      memberRoleIds: ["owner-role-id"],
    });
    (interaction as Record<string, unknown>).client = {
      ...interaction.client,
      channels: { fetch: vi.fn().mockResolvedValue(null) },
    };

    const context = createMockCommandContext();
    (context.strikeService.addStrike as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "added",
      strike: { id: "strike-3" },
      newStrikeCount: 3,
    });

    await command.execute(interaction as never, context);

    const embed = interaction.reply.mock.calls[0][0].embeds[0].toJSON();
    expect(embed.fields?.some((f: { name: string }) => f.name.includes("Maximum Strikes"))).toBe(true);
  });

  it("rejects when user already at max strikes", async () => {
    const command = new StrikeCommand();
    const interaction = createMockInteraction({
      user: { id: "1213817849693478972" },
      targetUsers: { member: { id: "target-user" } },
      stringOptions: { reason: "late" },
      inGuild: true,
      memberRoleIds: ["owner-role-id"],
    });

    const context = createMockCommandContext();
    (context.strikeService.addStrike as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "maxStrikes",
      newStrikeCount: 3,
    });

    await command.execute(interaction as never, context);

    const embed = interaction.reply.mock.calls[0][0].embeds[0].toJSON();
    expect(embed.description).toContain("3/3");
  });
});

describe("RemoveStrikeCommand", () => {
  it("removes a strike and shows new count", async () => {
    const command = new RemoveStrikeCommand();
    const interaction = createMockInteraction({
      user: { id: "1213817849693478972" },
      stringOptions: { strike_id: "strike-1", reason: "Appealed successfully" },
      inGuild: true,
      memberRoleIds: ["owner-role-id"],
    });
    (interaction as Record<string, unknown>).client = {
      ...interaction.client,
      channels: { fetch: vi.fn().mockResolvedValue(null) },
    };

    const context = createMockCommandContext();
    (context.strikeService.removeStrike as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "removed",
      newStrikeCount: 1,
    });

    await command.execute(interaction as never, context);

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const embed = interaction.reply.mock.calls[0][0].embeds[0].toJSON();
    expect(embed.title).toContain("Removed");
    expect(embed.fields?.some((f: { name: string; value: string }) => f.value.includes("1/3"))).toBe(true);
  });

  it("shows not found when strike ID is invalid", async () => {
    const command = new RemoveStrikeCommand();
    const interaction = createMockInteraction({
      user: { id: "1213817849693478972" },
      stringOptions: { strike_id: "bad-id", reason: "mistake" },
      inGuild: true,
      memberRoleIds: ["owner-role-id"],
    });

    const context = createMockCommandContext();
    (context.strikeService.removeStrike as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "strikeNotFound",
      newStrikeCount: 0,
    });

    await command.execute(interaction as never, context);

    const embed = interaction.reply.mock.calls[0][0].embeds[0].toJSON();
    expect(embed.description).toContain("No strike found");
  });
});

describe("AppealStrikeCommand", () => {
  it("files an appeal with Accept/Deny buttons", async () => {
    const command = new AppealStrikeCommand();
    const interaction = createMockInteraction({
      user: { id: "user-1" },
      stringOptions: { strike_id: "strike-1", reason: "I was sick" },
    });

    const context = createMockCommandContext();
    (context.strikeService.fileAppeal as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "filed",
      strike: { id: "strike-1", reason: "late", detail: "May 5th", appealStatus: "pending" },
    });

    await command.execute(interaction as never, context);

    expect(context.strikeService.fileAppeal).toHaveBeenCalledWith("strike-1", "user-1", "I was sick");
    expect(interaction.reply).toHaveBeenCalledTimes(1);

    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.embeds[0].toJSON().title).toContain("Appeal Filed");
    expect(payload.components).toBeDefined();
    expect(payload.components.length).toBe(1);
  });

  it("rejects appeal for someone else's strike", async () => {
    const command = new AppealStrikeCommand();
    const interaction = createMockInteraction({
      user: { id: "user-1" },
      stringOptions: { strike_id: "strike-1", reason: "unfair" },
    });

    const context = createMockCommandContext();
    (context.strikeService.fileAppeal as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "notOwner",
    });

    await command.execute(interaction as never, context);

    const embed = interaction.reply.mock.calls[0][0].embeds[0].toJSON();
    expect(embed.description).toContain("only appeal strikes");
    expect(interaction.reply.mock.calls[0][0].flags).toBe(MessageFlags.Ephemeral);
  });

  it("rejects when appeal is already pending", async () => {
    const command = new AppealStrikeCommand();
    const interaction = createMockInteraction({
      user: { id: "user-1" },
      stringOptions: { strike_id: "strike-1", reason: "please" },
    });

    const context = createMockCommandContext();
    (context.strikeService.fileAppeal as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "alreadyPending",
      strike: { appealStatus: "pending" },
    });

    await command.execute(interaction as never, context);

    const embed = interaction.reply.mock.calls[0][0].embeds[0].toJSON();
    expect(embed.description).toContain("pending appeal");
  });
});
