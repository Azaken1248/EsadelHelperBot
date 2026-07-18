import { describe, expect, it, vi } from "vitest";

import { HelloCommand } from "../../src/commands/modules/utility/hello.command";
import { PingCommand } from "../../src/commands/modules/utility/ping.command";
import { ProfileCommand } from "../../src/commands/modules/utility/profile.command";
import { UptimeCommand } from "../../src/commands/modules/utility/uptime.command";
import { createMockCommandContext, createMockInteraction } from "../helpers/mocks";

describe("utility commands", () => {
  it("HelloCommand replies with greeting embed", async () => {
    const command = new HelloCommand();
    const interaction = createMockInteraction({
      user: { id: "user-1" },
    });

    await command.execute(interaction as never, createMockCommandContext());

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const payload = interaction.reply.mock.calls[0][0];
    const embed = payload.embeds[0].toJSON();

    expect(embed.title).toBe("Esadel Greeting");
    expect(embed.description).toContain("<@user-1>");
  });

  it("PingCommand replies with latency fields", async () => {
    const command = new PingCommand();
    const interaction = createMockInteraction({
      createdTimestamp: Date.now() - 50,
      apiLatencyMs: 123,
    });

    await command.execute(interaction as never, createMockCommandContext());

    const payload = interaction.reply.mock.calls[0][0];
    const embed = payload.embeds[0].toJSON();

    expect(embed.title).toBe("Esadel Ping Check");
    expect(embed.fields?.some((field: { name: string; value: string }) => field.name === "Discord API" && field.value === "123ms")).toBe(true);
  });

  it("UptimeCommand formats and replies uptime", async () => {
    const command = new UptimeCommand();
    const interaction = createMockInteraction();

    const uptimeSpy = vi.spyOn(process, "uptime").mockReturnValue(3661);

    await command.execute(interaction as never, createMockCommandContext());

    uptimeSpy.mockRestore();

    const payload = interaction.reply.mock.calls[0][0];
    const embed = payload.embeds[0].toJSON();

    expect(embed.description).toContain("1h 1m 1s");
  });

  it("ProfileCommand responds with onboarding hint when profile is missing", async () => {
    const command = new ProfileCommand();
    const interaction = createMockInteraction({
      user: { id: "user-1" },
    });
    const context = createMockCommandContext();
    (context.userService.getProfile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await command.execute(interaction as never, context);

    const payload = interaction.reply.mock.calls[0][0];
    const embed = payload.embeds[0].toJSON();

    expect(embed.title).toBe("Esadel Profile Board");
    expect(embed.description).toContain("onboard them first");
  });

  it("ProfileCommand renders stats, roles, and deboard note when profile exists", async () => {
    const command = new ProfileCommand();
    const interaction = createMockInteraction({
      user: { id: "invoker-id" },
      targetUsers: {
        user: {
          id: "target-id",
          username: "target-user",
        },
      },
      inGuild: true,
      // Esadel starts with no specialized roles configured, so only the
      // structural Owner role resolves here.
      memberRoleIds: ["owner-role-id"],
    });

    const context = createMockCommandContext();
    (context.userService.getProfile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: {
        joinedAt: new Date("2026-01-01T00:00:00.000Z"),
        deboardedAt: new Date("2026-02-01T00:00:00.000Z"),
        deboardedMessage: "Moved to a different sekai",
        isDeboarded: true,
        isOnHiatus: false,
        strikes: 1,
      },
      assignmentStats: {
        total: 10,
        pending: 3,
        completed: 5,
        late: 1,
        excused: 1,
      },
    });

    await command.execute(interaction as never, context);

    const payload = interaction.reply.mock.calls[0][0];
    const embed = payload.embeds[0].toJSON();

    expect(embed.fields?.some((field: { name: string; value: string }) =>
      field.name.includes("Roster Status") && field.value.includes("Owner"),
    )).toBe(true);

    expect(embed.fields?.some((field: { name: string; value: string }) =>
      field.name.includes("Assignment Record") && field.value.includes("Total     : 10"),
    )).toBe(true);

    expect(embed.fields?.some((field: { name: string; value: string }) =>
      field.name.includes("Deboard Note") && field.value.includes("Moved to a different team."),
    )).toBe(true);
  });

  it("ProfileCommand shows hiatus details when user is on hiatus", async () => {
    const command = new ProfileCommand();
    const interaction = createMockInteraction({
      user: { id: "user-1" },
      inGuild: true,
    });

    const context = createMockCommandContext();
    (context.userService.getProfile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: {
        joinedAt: new Date("2026-01-01T00:00:00.000Z"),
        deboardedAt: null,
        deboardedMessage: "",
        isDeboarded: false,
        isOnHiatus: true,
        hiatusStartedAt: new Date("2026-05-01T00:00:00.000Z"),
        hiatusReason: "Taking exams",
        strikes: 0,
      },
      assignmentStats: {
        total: 5,
        pending: 2,
        completed: 3,
        late: 0,
        excused: 0,
      },
    });

    await command.execute(interaction as never, context);

    const payload = interaction.reply.mock.calls[0][0];
    const embed = payload.embeds[0].toJSON();

    expect(embed.fields?.some((f: { name: string; value: string }) =>
      f.name.includes("Roster Status") && f.value.includes("ON HIATUS"),
    )).toBe(true);

    expect(embed.fields?.some((f: { name: string; value: string }) =>
      f.name === "◈ Hiatus Since",
    )).toBe(true);

    expect(embed.fields?.some((f: { name: string; value: string }) =>
      f.name === "◈ Hiatus Reason" && f.value.includes("Taking exams"),
    )).toBe(true);
  });

  it("ProfileCommand shows max-strike warning when user has 3 strikes", async () => {
    const command = new ProfileCommand();
    const interaction = createMockInteraction({
      user: { id: "user-1" },
      inGuild: true,
    });

    const context = createMockCommandContext();
    (context.userService.getProfile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: {
        joinedAt: new Date("2026-01-01T00:00:00.000Z"),
        deboardedAt: null,
        deboardedMessage: "",
        isDeboarded: false,
        isOnHiatus: false,
        strikes: 3,
      },
      assignmentStats: {
        total: 5,
        pending: 2,
        completed: 3,
        late: 0,
        excused: 0,
      },
    });

    await command.execute(interaction as never, context);

    const embed = interaction.reply.mock.calls[0][0].embeds[0].toJSON();

    expect(embed.fields?.some((f: { name: string }) =>
      f.name.includes("Maximum Strikes"),
    )).toBe(true);

    expect(embed.fields?.some((f: { name: string; value: string }) =>
      f.name.includes("Roster Status") && f.value.includes("⚠️"),
    )).toBe(true);
  });
});
