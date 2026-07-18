import { MessageFlags } from "discord.js";
import { describe, expect, it, vi } from "vitest";

import { DeboardCommand } from "../../src/commands/modules/crew/deboard.command";
import { OnboardCommand } from "../../src/commands/modules/crew/onboard.command";
import { ensureOwnerAccess } from "../../src/commands/modules/crew/owner-access";
import { createMockCommandContext, createMockInteraction } from "../helpers/mocks";

describe("ensureOwnerAccess", () => {
  it("grants access to bypass user", async () => {
    const interaction = createMockInteraction({
      user: {
        id: "1213817849693478972",
      },
      inGuild: true,
      memberRoleIds: [],
    });
    const context = createMockCommandContext();

    const result = await ensureOwnerAccess(interaction as never, context);

    expect(result).toBe(true);
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it("rejects when owner roles are not configured", async () => {
    const interaction = createMockInteraction({
      inGuild: true,
      memberRoleIds: [],
    });
    const context = createMockCommandContext({
      configCacheService: {
        getConfig: vi.fn().mockReturnValue({ ownerRoleIds: [] }),
        loadConfig: vi.fn().mockResolvedValue({ ownerRoleIds: [] }),
        refreshConfig: vi.fn(),
      } as never,
    });

    const result = await ensureOwnerAccess(interaction as never, context);

    expect(result).toBe(false);
    expect(interaction.reply).toHaveBeenCalledTimes(1);
  });

  it("rejects non-owner members", async () => {
    const interaction = createMockInteraction({
      inGuild: true,
      memberRoleIds: [],
    });
    const context = createMockCommandContext();

    const result = await ensureOwnerAccess(interaction as never, context);

    expect(result).toBe(false);
    expect(interaction.reply).toHaveBeenCalledTimes(1);
  });
});

describe("OnboardCommand", () => {
  it("onboards members with owner access and replies with embed", async () => {
    const command = new OnboardCommand();
    const interaction = createMockInteraction({
      inGuild: true,
      memberRoleIds: ["owner-role-id"],
      targetUsers: {
        member: {
          id: "target-id",
          username: "target-name",
        },
      },
    });

    const context = createMockCommandContext();
    (context.userService.onboard as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "created",
      user: {
        joinedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });

    await command.execute(interaction as never, context);

    expect(context.userService.onboard).toHaveBeenCalledWith("target-id", "target-name");
    expect(interaction.reply).toHaveBeenCalledTimes(1);

    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.flags).toBe(MessageFlags.Ephemeral);

    const embed = payload.embeds[0].toJSON();
    expect(embed.title).toBe("Esadel Crew Onboarding");
    expect(embed.fields?.some((field: { name: string; value: string }) => field.name === "Result" && field.value === "New profile created")).toBe(true);
  });

  it("returns early when caller has no owner access", async () => {
    const command = new OnboardCommand();
    const interaction = createMockInteraction({
      inGuild: true,
      memberRoleIds: [],
      targetUsers: {
        member: {
          id: "target-id",
        },
      },
    });

    const context = createMockCommandContext();

    await command.execute(interaction as never, context);

    expect(context.userService.onboard).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledTimes(1);
  });
});

describe("DeboardCommand", () => {
  it("deboards members and includes status fields in embed", async () => {
    const command = new DeboardCommand();
    const interaction = createMockInteraction({
      inGuild: true,
      memberRoleIds: ["owner-role-id"],
      targetUsers: {
        member: {
          id: "target-id",
        },
      },
      stringOptions: {
        reason: "Needed roster cleanup",
      },
    });

    const context = createMockCommandContext();
    (context.userService.deboard as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "deboarded",
      user: {
        deboardedAt: new Date("2026-02-01T00:00:00.000Z"),
        deboardedMessage: "Needed roster cleanup",
      },
    });

    await command.execute(interaction as never, context);

    expect(context.userService.deboard).toHaveBeenCalledWith("target-id", "Needed roster cleanup");

    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.flags).toBe(MessageFlags.Ephemeral);

    const embed = payload.embeds[0].toJSON();
    expect(embed.title).toBe("Esadel Crew Deboarding");
    expect(embed.fields?.some((field: { name: string; value: string }) => field.name === "Result" && field.value === "Deboarded")).toBe(true);
  });

  it("handles missing profiles gracefully", async () => {
    const command = new DeboardCommand();
    const interaction = createMockInteraction({
      inGuild: true,
      memberRoleIds: ["owner-role-id"],
      targetUsers: {
        member: {
          id: "target-id",
        },
      },
    });

    const context = createMockCommandContext();
    (context.userService.deboard as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "notFound",
      user: null,
    });

    await command.execute(interaction as never, context);

    const payload = interaction.reply.mock.calls[0][0];
    const embed = payload.embeds[0].toJSON();

    expect(embed.description).toContain("No crew profile exists");
  });
});
