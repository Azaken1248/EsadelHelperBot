import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";

import type { AppConfig } from "../config/env";
import type { Logger } from "../core/logger/logger";
import type { LogBroadcaster } from "../core/logger/log-broadcaster";
import type { IGuildConfig } from "../models/guild-config.model";
import type {
  GuildConfigRepository,
  UpdateGuildConfigInput,
} from "../repositories/interfaces/guild-config-repository";
import type { ConfigCacheService } from "../services/config-cache-service";
import type { GatekeeperService } from "../services/gatekeeper-service";

interface GuildConfigDto {
  guildId: string;
  ownerRoleIds: string[];
  managerRoleIds: string[];
  baseCrewRoleId: string;
  specializedRoles: Record<string, string>;
  extensionRules: {
    maxStandardExtensions: number | null;
    blockTimeLimitedAutoExtension: boolean;
  };
}

/**
 * Embedded HTTP API — the bot process owns the domain and exposes it over HTTP
 * so the (separate) dashboard frontend stays a thin client. Endpoints:
 *   GET   /api/health              (public)
 *   GET   /api/config/:guildId     (JWT) — read guild config
 *   PATCH /api/config/:guildId     (JWT) — edit config; refreshes the bot's cache
 *   GET   /api/logs/stream         (JWT via ?token=) — SSE live log feed
 *   POST  /api/verify              (captcha-gated) — gatekeeper verification
 *
 * Disabled entirely unless ANALYTICS_JWT_SECRET is set.
 */
export class ApiServer {
  private app: FastifyInstance | null = null;
  private readonly startedAt = Date.now();

  constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger,
    private readonly logBroadcaster: LogBroadcaster,
    private readonly guildConfigRepository: GuildConfigRepository,
    private readonly configCacheService: ConfigCacheService,
    private readonly gatekeeperService: GatekeeperService,
  ) {}

  isEnabled(): boolean {
    return this.config.web.jwtSecret !== null;
  }

  async start(): Promise<void> {
    const secret = this.config.web.jwtSecret;
    if (!secret) {
      this.logger.info("HTTP API disabled (ANALYTICS_JWT_SECRET unset).");
      return;
    }

    const app = Fastify({ logger: false });
    await app.register(cors, { origin: true });
    await app.register(jwt, { secret });

    this.registerRoutes(app);

    await app.listen({ port: this.config.web.port, host: "0.0.0.0" });
    this.app = app;
    this.logger.info("HTTP API listening.", { port: this.config.web.port });
  }

  async stop(): Promise<void> {
    if (this.app) {
      await this.app.close();
      this.app = null;
    }
  }

  /** Exposed for tests: builds the configured Fastify instance without listening. */
  async buildTestInstance(): Promise<FastifyInstance> {
    const app = Fastify({ logger: false });
    await app.register(cors, { origin: true });
    await app.register(jwt, { secret: this.config.web.jwtSecret ?? "test-secret" });
    this.registerRoutes(app);
    await app.ready();
    return app;
  }

  private registerRoutes(app: FastifyInstance): void {
    const authenticate = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        await request.jwtVerify();
      } catch {
        await reply.code(401).send({ error: "unauthorized" });
      }
    };

    app.get("/api/health", async () => ({
      status: "ok",
      uptimeMs: Date.now() - this.startedAt,
    }));

    app.get(
      "/api/config/:guildId",
      { preHandler: authenticate },
      async (request, reply) => {
        const { guildId } = request.params as { guildId: string };
        const config = await this.guildConfigRepository.findByGuildId(guildId);
        if (!config) {
          return reply.code(404).send({ error: "guild config not found" });
        }
        return this.toConfigDto(config);
      },
    );

    app.patch(
      "/api/config/:guildId",
      { preHandler: authenticate },
      async (request, reply) => {
        const { guildId } = request.params as { guildId: string };
        const patch = this.parseConfigPatch(request.body);
        if (patch === null) {
          return reply.code(400).send({ error: "invalid config patch" });
        }

        const updated = await this.guildConfigRepository.update(guildId, patch);
        if (!updated) {
          return reply.code(404).send({ error: "guild config not found" });
        }

        // The bot picks up the change immediately — same process, no cross-service hop.
        await this.configCacheService.refreshConfig(guildId);
        this.logger.info("Guild config edited via API.", { guildId });
        return this.toConfigDto(updated);
      },
    );

    app.get("/api/logs/stream", async (request, reply) => {
      // EventSource can't set an Authorization header, so the token comes via query.
      const token = (request.query as { token?: string }).token;
      try {
        await app.jwt.verify(token ?? "");
      } catch {
        return reply.code(401).send({ error: "unauthorized" });
      }

      reply.hijack();
      const raw = reply.raw;
      raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      const write = (data: unknown): void => {
        raw.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      for (const entry of this.logBroadcaster.recent()) {
        write(entry);
      }
      const unsubscribe = this.logBroadcaster.subscribe(write);
      request.raw.on("close", () => {
        unsubscribe();
      });
      return reply;
    });

    app.post("/api/verify", async (request, reply) => {
      const body = (request.body ?? {}) as { token?: string; guildId?: string; captcha?: string };
      if (!body.token || !body.guildId) {
        return reply.code(400).send({ error: "token and guildId are required" });
      }

      if (this.config.captcha.secretKey) {
        const captchaOk = await this.verifyCaptcha(body.captcha);
        if (!captchaOk) {
          return reply.code(400).send({ status: "captchaFailed" });
        }
      }

      const result = await this.gatekeeperService.verifyMember(body.token, body.guildId);
      const status = result.status === "verified" ? 200 : 400;
      return reply.code(status).send({ status: result.status });
    });
  }

  private parseConfigPatch(body: unknown): UpdateGuildConfigInput | null {
    if (typeof body !== "object" || body === null) {
      return null;
    }
    const source = body as Record<string, unknown>;
    const patch: UpdateGuildConfigInput = {};

    if (Array.isArray(source.ownerRoleIds)) patch.ownerRoleIds = source.ownerRoleIds.map(String);
    if (Array.isArray(source.managerRoleIds)) patch.managerRoleIds = source.managerRoleIds.map(String);
    if (typeof source.baseCrewRoleId === "string") patch.baseCrewRoleId = source.baseCrewRoleId;
    if (typeof source.specializedRoles === "object" && source.specializedRoles !== null) {
      patch.specializedRoles = Object.fromEntries(
        Object.entries(source.specializedRoles as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
      );
    }
    if (source.maxStandardExtensions === null || typeof source.maxStandardExtensions === "number") {
      patch.maxStandardExtensions = source.maxStandardExtensions as number | null;
    }
    if (typeof source.blockTimeLimitedAutoExtension === "boolean") {
      patch.blockTimeLimitedAutoExtension = source.blockTimeLimitedAutoExtension;
    }

    return Object.keys(patch).length > 0 ? patch : null;
  }

  private toConfigDto(config: IGuildConfig): GuildConfigDto {
    return {
      guildId: config.guildId,
      ownerRoleIds: config.ownerRoleIds,
      managerRoleIds: config.managerRoleIds,
      baseCrewRoleId: config.baseCrewRoleId,
      specializedRoles: Object.fromEntries(config.specializedRoles),
      extensionRules: {
        maxStandardExtensions: config.extensionRules.maxStandardExtensions,
        blockTimeLimitedAutoExtension: config.extensionRules.blockTimeLimitedAutoExtension,
      },
    };
  }

  private async verifyCaptcha(captchaResponse: string | undefined): Promise<boolean> {
    if (!captchaResponse) {
      return false;
    }
    const secret = this.config.captcha.secretKey;
    if (!secret) {
      return true;
    }
    try {
      const body = new URLSearchParams({ secret, response: captchaResponse });
      const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const json = (await res.json()) as { success?: boolean };
      return json.success === true;
    } catch (error) {
      this.logger.warn("Captcha verification request failed.", {
        message: error instanceof Error ? error.message : "Unknown error.",
      });
      return false;
    }
  }
}
