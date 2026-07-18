import type { AppConfig } from "../config/env";
import { SPECIALIZED_ROLE_LABELS, type SpecializedRoleKey } from "../config/constants";
import type { Logger } from "../core/logger/logger";
import type { IGuildConfig } from "../models/guild-config.model";
import type {
  CreateGuildConfigInput,
  GuildConfigRepository,
} from "../repositories/interfaces/guild-config-repository";

const isDuplicateKeyError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeCode = (error as { code?: unknown }).code;
  return typeof maybeCode === "number" && maybeCode === 11000;
};

export class ConfigCacheService {
  private readonly cache = new Map<string, IGuildConfig>();

  constructor(
    private readonly guildConfigRepository: GuildConfigRepository,
    private readonly appConfig: AppConfig,
    private readonly logger: Logger,
  ) {}

  async loadConfig(guildId: string): Promise<IGuildConfig> {
    const normalizedGuildId = guildId.trim();

    const existingConfig = await this.guildConfigRepository.findByGuildId(normalizedGuildId);
    if (existingConfig) {
      this.cache.set(normalizedGuildId, existingConfig);
      return existingConfig;
    }

    const seededConfig = await this.seedDefaultConfig(normalizedGuildId);
    this.cache.set(normalizedGuildId, seededConfig);

    this.logger.info("Guild config cache seeded with defaults.", {
      guildId: normalizedGuildId,
    });

    return seededConfig;
  }

  getConfig(guildId: string): IGuildConfig {
    const normalizedGuildId = guildId.trim();
    const cachedConfig = this.cache.get(normalizedGuildId);

    if (!cachedConfig) {
      throw new Error(
        `Guild config for '${normalizedGuildId}' is not loaded. Call loadConfig() first.`,
      );
    }

    return cachedConfig;
  }

  async refreshConfig(guildId: string): Promise<IGuildConfig> {
    const normalizedGuildId = guildId.trim();
    const latestConfig = await this.guildConfigRepository.findByGuildId(normalizedGuildId);

    if (!latestConfig) {
      return this.loadConfig(normalizedGuildId);
    }

    this.cache.set(normalizedGuildId, latestConfig);

    this.logger.info("Guild config cache refreshed.", {
      guildId: normalizedGuildId,
    });

    return latestConfig;
  }

  private async seedDefaultConfig(guildId: string): Promise<IGuildConfig> {
    const defaultInput = this.buildDefaultConfigInput(guildId);

    try {
      return await this.guildConfigRepository.create(defaultInput);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const existingConfig = await this.guildConfigRepository.findByGuildId(guildId);
        if (existingConfig) {
          return existingConfig;
        }
      }

      throw error;
    }
  }

  private buildDefaultConfigInput(guildId: string): CreateGuildConfigInput {
    const specializedEntries = Object.entries(this.appConfig.roles.specialized) as [
      SpecializedRoleKey,
      string,
    ][];
    const specializedRoles = specializedEntries.reduce(
      (accumulator, [roleKey, roleId]) => {
        const roleName = SPECIALIZED_ROLE_LABELS[roleKey];
        accumulator[roleName] = roleId;
        return accumulator;
      },
      {} as Record<string, string>,
    );

    return {
      guildId,
      ownerRoleIds: [this.appConfig.roles.owners],
      managerRoleIds: [this.appConfig.roles.mods],
      baseCrewRoleId: this.appConfig.roles.crew,
      specializedRoles,
      maxStandardExtensions: this.appConfig.extensionRules.maxStandardExtensions,
      blockTimeLimitedAutoExtension:
        this.appConfig.extensionRules.blockTimeLimitedAutoExtension,
    };
  }
}
