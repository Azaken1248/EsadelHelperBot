import { describe, expect, it, vi } from "vitest";

import { InteractionCreateHandler } from "../../src/commands/handlers/interaction-create-handler";
import type { StrikeAppealHandler } from "../../src/commands/handlers/strike-appeal-handler";
import type { SubmitApprovalHandler } from "../../src/commands/handlers/submit-approval-handler";
import type { UserRepository } from "../../src/repositories/interfaces/user-repository";
import { CommandRegistry } from "../../src/commands/registry/command-registry";
import { createMockCommandContext, createMockInteraction, createMockLogger } from "../helpers/mocks";

const createMockSubmitApprovalHandler = (): SubmitApprovalHandler => ({
  canHandle: vi.fn().mockReturnValue(false),
  handle: vi.fn().mockResolvedValue(undefined),
}) as unknown as SubmitApprovalHandler;

const createMockStrikeAppealHandler = (): StrikeAppealHandler => ({
  canHandle: vi.fn().mockReturnValue(false),
  handle: vi.fn().mockResolvedValue(undefined),
}) as unknown as StrikeAppealHandler;

const createMockUserRepository = (overrides: Record<string, unknown> = {}): UserRepository => ({
  findByDiscordId: vi.fn().mockResolvedValue(null),
  findAllActive: vi.fn().mockResolvedValue([]),
  create: vi.fn(),
  reactivate: vi.fn(),
  markDeboarded: vi.fn(),
  setHiatus: vi.fn(),
  incrementStrikes: vi.fn(),
  appendAssignment: vi.fn(),
  removeAssignment: vi.fn(),
  ...overrides,
}) as unknown as UserRepository;

const buildHandler = (
  registry?: CommandRegistry,
  overrides?: {
    approval?: SubmitApprovalHandler;
    appeal?: StrikeAppealHandler;
    userRepo?: UserRepository;
    logger?: ReturnType<typeof createMockLogger>;
  },
) => {
  const reg = registry ?? new CommandRegistry();
  const approval = overrides?.approval ?? createMockSubmitApprovalHandler();
  const appeal = overrides?.appeal ?? createMockStrikeAppealHandler();
  const userRepo = overrides?.userRepo ?? createMockUserRepository();
  const logger = overrides?.logger ?? createMockLogger();
  return new InteractionCreateHandler(reg, createMockCommandContext(), approval, appeal, userRepo, logger);
};

type HandleInteraction = { handleInteraction: (interaction: unknown) => Promise<void> };

describe("InteractionCreateHandler", () => {
  it("ignores non-chat non-button interactions", async () => {
    const handler = buildHandler();

    const interaction = {
      isChatInputCommand: vi.fn().mockReturnValue(false),
      isButton: vi.fn().mockReturnValue(false),
      isAutocomplete: vi.fn().mockReturnValue(false),
    };

    await (handler as unknown as HandleInteraction).handleInteraction(interaction);

    expect(interaction.isButton).toHaveBeenCalledTimes(1);
    expect(interaction.isChatInputCommand).toHaveBeenCalledTimes(1);
  });

  it("replies when command is not registered", async () => {
    const handler = buildHandler();

    const interaction = {
      ...createMockInteraction({ commandName: "unknown" }),
      isChatInputCommand: vi.fn().mockReturnValue(true),
      isButton: vi.fn().mockReturnValue(false),
      isAutocomplete: vi.fn().mockReturnValue(false),
    };

    await (handler as unknown as HandleInteraction).handleInteraction(interaction);

    expect(interaction.reply).toHaveBeenCalledTimes(1);
  });

  it("blocks role-gated commands when member lacks required role", async () => {
    const registry = new CommandRegistry();
    const execute = vi.fn();
    registry.register({
      data: { name: "admin-only" },
      requiredRoleIds: ["role-required"],
      execute,
    } as never);

    const handler = buildHandler(registry);

    const interaction = {
      ...createMockInteraction({
        commandName: "admin-only",
        inGuild: true,
        memberRoleIds: [],
        user: { id: "regular-user" },
      }),
      isChatInputCommand: vi.fn().mockReturnValue(true),
      isButton: vi.fn().mockReturnValue(false),
      isAutocomplete: vi.fn().mockReturnValue(false),
    };

    await (handler as unknown as HandleInteraction).handleInteraction(interaction);

    expect(execute).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledTimes(1);
  });

  it("allows bypass user to execute role-gated commands", async () => {
    const registry = new CommandRegistry();
    const execute = vi.fn().mockResolvedValue(undefined);
    registry.register({
      data: { name: "admin-only" },
      requiredRoleIds: ["role-required"],
      execute,
    } as never);

    const handler = buildHandler(registry);

    const interaction = {
      ...createMockInteraction({
        commandName: "admin-only",
        inGuild: true,
        memberRoleIds: [],
        user: { id: "1213817849693478972" },
      }),
      isChatInputCommand: vi.fn().mockReturnValue(true),
      isButton: vi.fn().mockReturnValue(false),
      isAutocomplete: vi.fn().mockReturnValue(false),
    };

    await (handler as unknown as HandleInteraction).handleInteraction(interaction);

    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("replies with command error when execution throws before initial reply", async () => {
    const logger = createMockLogger();
    const registry = new CommandRegistry();
    registry.register({
      data: { name: "throws" },
      execute: vi.fn().mockRejectedValue(new Error("expected failure")),
    } as never);

    const handler = buildHandler(registry, { logger });

    const interaction = {
      ...createMockInteraction({ commandName: "throws", replied: false, deferred: false }),
      isChatInputCommand: vi.fn().mockReturnValue(true),
      isButton: vi.fn().mockReturnValue(false),
      isAutocomplete: vi.fn().mockReturnValue(false),
    };

    await (handler as unknown as HandleInteraction).handleInteraction(interaction);

    expect(logger.error).toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledTimes(1);
  });

  it("follows up with command error when interaction is already replied", async () => {
    const registry = new CommandRegistry();
    registry.register({
      data: { name: "throws" },
      execute: vi.fn().mockRejectedValue(new Error("expected failure")),
    } as never);

    const handler = buildHandler(registry);

    const interaction = {
      ...createMockInteraction({ commandName: "throws", replied: true, deferred: false }),
      isChatInputCommand: vi.fn().mockReturnValue(true),
      isButton: vi.fn().mockReturnValue(false),
      isAutocomplete: vi.fn().mockReturnValue(false),
    };

    await (handler as unknown as HandleInteraction).handleInteraction(interaction);

    expect(interaction.followUp).toHaveBeenCalledTimes(1);
  });

  it("routes button interactions to submit approval handler when canHandle returns true", async () => {
    const mockApproval = {
      canHandle: vi.fn().mockReturnValue(true),
      handle: vi.fn().mockResolvedValue(undefined),
    } as unknown as SubmitApprovalHandler;
    const handler = buildHandler(undefined, { approval: mockApproval });

    const interaction = {
      isButton: vi.fn().mockReturnValue(true),
      isChatInputCommand: vi.fn().mockReturnValue(false),
      customId: "submit_approve:assignment-1",
      user: { id: "reviewer-id" },
      replied: false,
      deferred: false,
    };

    await (handler as unknown as HandleInteraction).handleInteraction(interaction);

    expect(mockApproval.canHandle).toHaveBeenCalledWith("submit_approve:assignment-1");
    expect(mockApproval.handle).toHaveBeenCalledWith(interaction);
  });

  it("routes appeal button interactions to strike appeal handler", async () => {
    const mockAppeal = {
      canHandle: vi.fn().mockReturnValue(true),
      handle: vi.fn().mockResolvedValue(undefined),
    } as unknown as StrikeAppealHandler;
    const handler = buildHandler(undefined, { appeal: mockAppeal });

    const interaction = {
      isButton: vi.fn().mockReturnValue(true),
      isChatInputCommand: vi.fn().mockReturnValue(false),
      customId: "appeal_accept:strike-1",
      user: { id: "reviewer-id" },
      replied: false,
      deferred: false,
    };

    await (handler as unknown as HandleInteraction).handleInteraction(interaction);

    expect(mockAppeal.canHandle).toHaveBeenCalledWith("appeal_accept:strike-1");
    expect(mockAppeal.handle).toHaveBeenCalledWith(interaction);
  });

  it("sends strike warning follow-up when user has 3 strikes", async () => {
    const registry = new CommandRegistry();
    const execute = vi.fn().mockResolvedValue(undefined);
    registry.register({ data: { name: "test-cmd" }, execute } as never);

    const userRepo = createMockUserRepository({
      findByDiscordId: vi.fn().mockResolvedValue({ strikes: 3 }),
    });
    const handler = buildHandler(registry, { userRepo });

    const interaction = {
      ...createMockInteraction({ commandName: "test-cmd", user: { id: "user-1" } }),
      isChatInputCommand: vi.fn().mockReturnValue(true),
      isButton: vi.fn().mockReturnValue(false),
      isAutocomplete: vi.fn().mockReturnValue(false),
    };

    await (handler as unknown as HandleInteraction).handleInteraction(interaction);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(interaction.followUp).toHaveBeenCalledTimes(1);
    const embed = interaction.followUp.mock.calls[0][0].embeds[0].toJSON();
    expect(embed.title).toContain("Strike Warning");
  });

  it("does not send strike warning when user has fewer than 3 strikes", async () => {
    const registry = new CommandRegistry();
    const execute = vi.fn().mockResolvedValue(undefined);
    registry.register({ data: { name: "test-cmd" }, execute } as never);

    const userRepo = createMockUserRepository({
      findByDiscordId: vi.fn().mockResolvedValue({ strikes: 1 }),
    });
    const handler = buildHandler(registry, { userRepo });

    const interaction = {
      ...createMockInteraction({ commandName: "test-cmd", user: { id: "user-1" } }),
      isChatInputCommand: vi.fn().mockReturnValue(true),
      isButton: vi.fn().mockReturnValue(false),
      isAutocomplete: vi.fn().mockReturnValue(false),
    };

    await (handler as unknown as HandleInteraction).handleInteraction(interaction);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(interaction.followUp).not.toHaveBeenCalled();
  });
});
