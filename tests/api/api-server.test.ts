import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

import { ApiServer } from "../../src/api/api-server";
import { createMockLogger, createTestConfig } from "../helpers/mocks";

const guildConfigDoc = {
  guildId: "guild-id",
  ownerRoleIds: ["owner-role-id"],
  managerRoleIds: ["mod-role-id"],
  baseCrewRoleId: "crew-role-id",
  specializedRoles: new Map<string, string>([["Artist", "role-artist"]]),
  extensionRules: { maxStandardExtensions: 2, blockTimeLimitedAutoExtension: true },
};

const buildServer = (overrides: {
  guildConfigRepository?: Record<string, ReturnType<typeof vi.fn>>;
  configCacheService?: Record<string, ReturnType<typeof vi.fn>>;
  gatekeeperService?: Record<string, ReturnType<typeof vi.fn>>;
} = {}) => {
  const logBroadcaster = {
    recent: vi.fn().mockReturnValue([]),
    subscribe: vi.fn().mockReturnValue(() => {}),
  };
  const guildConfigRepository = overrides.guildConfigRepository ?? {
    findByGuildId: vi.fn().mockResolvedValue(guildConfigDoc),
    update: vi.fn().mockResolvedValue(guildConfigDoc),
    create: vi.fn(),
  };
  const configCacheService = overrides.configCacheService ?? {
    refreshConfig: vi.fn().mockResolvedValue(guildConfigDoc),
  };
  const gatekeeperService = overrides.gatekeeperService ?? {
    verifyMember: vi.fn().mockResolvedValue({ status: "verified", discordUserId: "u1" }),
  };

  const server = new ApiServer(
    createTestConfig(),
    createMockLogger(),
    logBroadcaster as never,
    guildConfigRepository as never,
    configCacheService as never,
    gatekeeperService as never,
  );

  return { server, guildConfigRepository, configCacheService, gatekeeperService };
};

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("ApiServer", () => {
  it("serves public health without auth", async () => {
    const { server } = buildServer();
    app = await server.buildTestInstance();

    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok" });
  });

  it("rejects config reads without a token", async () => {
    const { server } = buildServer();
    app = await server.buildTestInstance();

    const res = await app.inject({ method: "GET", url: "/api/config/guild-id" });
    expect(res.statusCode).toBe(401);
  });

  it("returns the guild config DTO with a valid token", async () => {
    const { server } = buildServer();
    app = await server.buildTestInstance();
    const token = app.jwt.sign({ sub: "admin" });

    const res = await app.inject({
      method: "GET",
      url: "/api/config/guild-id",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      guildId: "guild-id",
      specializedRoles: { Artist: "role-artist" },
    });
  });

  it("edits config and refreshes the bot cache", async () => {
    const { server, guildConfigRepository, configCacheService } = buildServer();
    app = await server.buildTestInstance();
    const token = app.jwt.sign({ sub: "admin" });

    const res = await app.inject({
      method: "PATCH",
      url: "/api/config/guild-id",
      headers: { authorization: `Bearer ${token}` },
      payload: { baseCrewRoleId: "new-crew-role" },
    });

    expect(res.statusCode).toBe(200);
    expect(guildConfigRepository.update).toHaveBeenCalledWith("guild-id", {
      baseCrewRoleId: "new-crew-role",
    });
    expect(configCacheService.refreshConfig).toHaveBeenCalledWith("guild-id");
  });

  it("rejects an empty config patch", async () => {
    const { server } = buildServer();
    app = await server.buildTestInstance();
    const token = app.jwt.sign({ sub: "admin" });

    const res = await app.inject({
      method: "PATCH",
      url: "/api/config/guild-id",
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });

  it("rejects the log stream without a token", async () => {
    const { server } = buildServer();
    app = await server.buildTestInstance();

    const res = await app.inject({ method: "GET", url: "/api/logs/stream" });
    expect(res.statusCode).toBe(401);
  });

  it("runs gatekeeper verification (captcha disabled in test config)", async () => {
    const configCacheService = { refreshConfig: vi.fn() };
    const gatekeeperService = { verifyMember: vi.fn().mockResolvedValue({ status: "verified" }) };
    const { server } = buildServer({ configCacheService, gatekeeperService });
    // test config has captcha.secretKey set; verifyCaptcha would call out — disable by clearing it
    (server as unknown as { config: { captcha: { secretKey: string | null } } }).config.captcha.secretKey = null;
    app = await server.buildTestInstance();

    const res = await app.inject({
      method: "POST",
      url: "/api/verify",
      payload: { token: "tok", guildId: "guild-id" },
    });

    expect(res.statusCode).toBe(200);
    expect(gatekeeperService.verifyMember).toHaveBeenCalledWith("tok", "guild-id");
  });
});
