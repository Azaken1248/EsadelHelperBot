import { describe, expect, it, vi } from "vitest";

import { GatekeeperService } from "../../src/services/gatekeeper-service";
import { createMockLogger, createTestConfig } from "../helpers/mocks";

const createVerificationRepo = () => ({
  create: vi.fn().mockResolvedValue({}),
  findByToken: vi.fn(),
  findLatestForUser: vi.fn(),
  updateStatusByToken: vi.fn().mockResolvedValue({}),
  markPendingTimedOut: vi.fn().mockResolvedValue(0),
});

describe("GatekeeperService", () => {
  describe("isEnabled", () => {
    it("is enabled when an unverified role is configured", () => {
      const service = new GatekeeperService(
        createTestConfig(),
        {} as never,
        createVerificationRepo() as never,
        createMockLogger(),
      );
      expect(service.isEnabled()).toBe(true);
    });

    it("is disabled when no unverified role is configured", () => {
      const config = { ...createTestConfig(), roles: { ...createTestConfig().roles, unverified: null } };
      const service = new GatekeeperService(
        config,
        {} as never,
        createVerificationRepo() as never,
        createMockLogger(),
      );
      expect(service.isEnabled()).toBe(false);
    });
  });

  describe("buildVerificationUrl", () => {
    it("builds a portal URL with the token", () => {
      const service = new GatekeeperService(
        createTestConfig(),
        {} as never,
        createVerificationRepo() as never,
        createMockLogger(),
      );
      expect(service.buildVerificationUrl("abc123")).toBe("https://portal.test/verify?token=abc123");
    });

    it("returns null when no portal is configured", () => {
      const config = { ...createTestConfig(), captcha: { ...createTestConfig().captcha, webPortalUrl: null } };
      const service = new GatekeeperService(
        config,
        {} as never,
        createVerificationRepo() as never,
        createMockLogger(),
      );
      expect(service.buildVerificationUrl("abc123")).toBeNull();
    });
  });

  describe("onMemberJoin", () => {
    it("assigns the unverified role, records the verification, and DMs the link", async () => {
      const repo = createVerificationRepo();
      const service = new GatekeeperService(
        createTestConfig(),
        {} as never,
        repo as never,
        createMockLogger(),
      );

      const member = {
        id: "new-user",
        guild: { id: "guild-id" },
        roles: { add: vi.fn().mockResolvedValue(undefined) },
        send: vi.fn().mockResolvedValue(undefined),
      };

      await service.onMemberJoin(member as never);

      expect(member.roles.add).toHaveBeenCalledWith("unverified-role-id");
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ discordUserId: "new-user", guildId: "guild-id" }),
      );
      expect(member.send).toHaveBeenCalledTimes(1);
    });

    it("swallows DM failures", async () => {
      const repo = createVerificationRepo();
      const service = new GatekeeperService(
        createTestConfig(),
        {} as never,
        repo as never,
        createMockLogger(),
      );

      const member = {
        id: "new-user",
        guild: { id: "guild-id" },
        roles: { add: vi.fn().mockResolvedValue(undefined) },
        send: vi.fn().mockRejectedValue(new Error("DMs closed")),
      };

      await expect(service.onMemberJoin(member as never)).resolves.toBeUndefined();
      expect(repo.create).toHaveBeenCalledTimes(1);
    });
  });

  describe("verifyMember", () => {
    it("returns invalidToken when the token is unknown", async () => {
      const repo = createVerificationRepo();
      repo.findByToken.mockResolvedValue(null);

      const service = new GatekeeperService(
        createTestConfig(),
        {} as never,
        repo as never,
        createMockLogger(),
      );

      const result = await service.verifyMember("bad-token", "guild-id");
      expect(result.status).toBe("invalidToken");
    });

    it("swaps roles and marks verified on success", async () => {
      const repo = createVerificationRepo();
      repo.findByToken.mockResolvedValue({
        discordUserId: "user-1",
        guildId: "guild-id",
        status: "PENDING",
      });

      const member = {
        roles: {
          add: vi.fn().mockResolvedValue(undefined),
          remove: vi.fn().mockResolvedValue(undefined),
        },
      };
      const discordClient = {
        guilds: {
          fetch: vi.fn().mockResolvedValue({
            members: { fetch: vi.fn().mockResolvedValue(member) },
          }),
        },
      };

      const service = new GatekeeperService(
        createTestConfig(),
        discordClient as never,
        repo as never,
        createMockLogger(),
      );

      const result = await service.verifyMember("good-token", "guild-id");

      expect(result.status).toBe("verified");
      expect(result.discordUserId).toBe("user-1");
      expect(member.roles.remove).toHaveBeenCalledWith("unverified-role-id");
      expect(member.roles.add).toHaveBeenCalledWith("crew-role-id");
      expect(repo.updateStatusByToken).toHaveBeenCalledWith("good-token", "VERIFIED", expect.any(Date));
    });

    it("returns disabled when the gatekeeper is off", async () => {
      const config = { ...createTestConfig(), roles: { ...createTestConfig().roles, unverified: null } };
      const service = new GatekeeperService(
        config,
        {} as never,
        createVerificationRepo() as never,
        createMockLogger(),
      );

      const result = await service.verifyMember("token", "guild-id");
      expect(result.status).toBe("disabled");
    });
  });
});
