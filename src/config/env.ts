import {
  DEFAULT_ROLE_IDS,
  DEFAULT_SPECIALIZED_ROLE_IDS,
  type SpecializedRoleKey,
} from "./constants";

export interface AppConfig {
  discord: {
    token: string;
    applicationId: string;
    guildId: string;
  };
  mongo: {
    uri: string;
  };
  channels: {
    approvalChannelId: string | null;
    remindersChannelId: string | null;
    logsChannelId: string | null;
    verificationChannelId: string | null;
  };
  roles: {
    owners: string;
    mods: string;
    crew: string;
    unverified: string | null;
    specialized: Record<SpecializedRoleKey, string>;
  };
  captcha: {
    siteKey: string | null;
    secretKey: string | null;
    webPortalUrl: string | null;
  };
  web: {
    port: number;
    jwtSecret: string | null;
    /** Allowed CORS origins; empty means same-origin/non-browser clients only. */
    corsOrigins: string[];
    /** Max requests per minute, per IP. */
    rateLimitPerMinute: number;
  };
  logging: {
    streamJson: boolean;
  };
  llm: {
    /** Text generation (expensive on CPU — the /ask conversational reply). */
    generationEnabled: boolean;
    /** Embeddings (cheap — one forward pass; powers semantic memory recall). */
    embeddingsEnabled: boolean;
    baseUrl: string;
    model: string;
    embedModel: string;
    timeoutMs: number;
    /** Lore entries fed to the model as grounding; fewer = far cheaper prompts. */
    maxContextEntries: number;
    /** Per-entry character cap applied to that grounding context. */
    maxContextCharsPerEntry: number;
  };
  extensionRules: {
    maxStandardExtensions: number | null;
    blockTimeLimitedAutoExtension: boolean;
  };
  reminders: {
    enabled: boolean;
    offsetMinutes: number[];
    pollIntervalMs: number;
    batchSize: number;
    lockDurationMs: number;
    maxAttempts: number;
  };
}

const readRequiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const readOptionalEnv = (name: string): string | null => {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : null;
};

const readWithDefault = (name: string, fallback: string): string => {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
};

const readCsvList = (name: string): string[] => {
  const value = readOptionalEnv(name);
  if (value === null) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const readOptionalNonNegativeInteger = (name: string): number | null => {
  const value = readOptionalEnv(name);
  if (value === null) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer when provided.`);
  }

  return parsed;
};

const readBooleanWithDefault = (name: string, fallback: boolean): boolean => {
  const value = readOptionalEnv(name);
  if (value === null) {
    return fallback;
  }

  if (value.toLowerCase() === "true") {
    return true;
  }

  if (value.toLowerCase() === "false") {
    return false;
  }

  throw new Error(`${name} must be either 'true' or 'false' when provided.`);
};

const readPositiveIntegerWithDefault = (name: string, fallback: number): number => {
  const value = readOptionalEnv(name);
  if (value === null) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer when provided.`);
  }

  return parsed;
};

const readReminderOffsetsWithDefault = (name: string, fallback: number[]): number[] => {
  const value = readOptionalEnv(name);
  if (value === null) {
    return [...fallback];
  }

  const offsets = value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => {
      const parsed = Number(item);
      if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error(`${name} must be a comma-separated list of non-negative integers.`);
      }

      return parsed;
    });

  if (offsets.length === 0) {
    throw new Error(`${name} must include at least one non-negative integer.`);
  }

  return [...new Set(offsets)].sort((a, b) => b - a);
};

// Convert a camelCase specialized-role key to its env variable name.
// e.g. "cardEditor" -> "ROLE_CARD_EDITOR_ID"
const specializedRoleEnvName = (key: string): string => {
  const upperSnake = key.replace(/[A-Z]/g, (char) => `_${char}`).toUpperCase();
  return `ROLE_${upperSnake}_ID`;
};

// Build the specialized role map dynamically from the keys declared in
// DEFAULT_SPECIALIZED_ROLE_IDS. Each key resolves from its ROLE_*_ID env var,
// falling back to the hardcoded default. Adding a key in constants.ts is enough
// to wire it here — no edit to this function is required.
const buildSpecializedRoleConfig = (): Record<SpecializedRoleKey, string> => {
  const defaults = DEFAULT_SPECIALIZED_ROLE_IDS as Readonly<Record<string, string>>;
  const config: Record<string, string> = {};

  for (const [key, fallback] of Object.entries(defaults)) {
    config[key] = readWithDefault(specializedRoleEnvName(key), fallback);
  }

  return config as Record<SpecializedRoleKey, string>;
};

/**
 * Returns the config paths of role IDs that are still unconfigured — either the
 * REPLACE_WITH_* placeholders from constants.ts or blank values. Used at
 * startup to warn the operator before role-dependent features misbehave.
 */
export const findPlaceholderRoleIds = (config: AppConfig): string[] => {
  const isPlaceholder = (value: string): boolean =>
    value.trim().length === 0 || value.startsWith("REPLACE_WITH_");

  const unconfigured: string[] = [];
  if (isPlaceholder(config.roles.owners)) unconfigured.push("roles.owners");
  if (isPlaceholder(config.roles.mods)) unconfigured.push("roles.mods");
  if (isPlaceholder(config.roles.crew)) unconfigured.push("roles.crew");

  for (const [key, roleId] of Object.entries(config.roles.specialized) as [string, string][]) {
    if (isPlaceholder(roleId)) {
      unconfigured.push(`roles.specialized.${key}`);
    }
  }

  return unconfigured;
};

export const loadAppConfig = (): AppConfig => {
  const guildId = readOptionalEnv("DISCORD_GUILD_ID") ?? readRequiredEnv("GUILD_ID");

  return {
    discord: {
      token: readRequiredEnv("DISCORD_TOKEN"),
      applicationId: readRequiredEnv("DISCORD_APPLICATION_ID"),
      guildId,
    },
    mongo: {
      uri: readRequiredEnv("MONGODB_URI"),
    },
    channels: {
      approvalChannelId: readOptionalEnv("APPROVAL_CHANNEL_ID"),
      remindersChannelId: readOptionalEnv("REMINDERS_CHANNEL_ID"),
      logsChannelId: readOptionalEnv("LOGS_CHANNEL_ID"),
      verificationChannelId: readOptionalEnv("VERIFICATION_CHANNEL_ID"),
    },
    roles: {
      owners: readWithDefault("ROLE_OWNER_ID", DEFAULT_ROLE_IDS.owners),
      mods: readWithDefault("ROLE_MOD_ID", DEFAULT_ROLE_IDS.mods),
      crew: readWithDefault("ROLE_CREW_ID", DEFAULT_ROLE_IDS.crew),
      unverified: readOptionalEnv("ROLE_UNVERIFIED_ID"),
      specialized: buildSpecializedRoleConfig(),
    },
    captcha: {
      siteKey: readOptionalEnv("CAPTCHA_SITE_KEY"),
      secretKey: readOptionalEnv("CAPTCHA_SECRET_KEY"),
      webPortalUrl: readOptionalEnv("WEB_PORTAL_URL"),
    },
    web: {
      port: readPositiveIntegerWithDefault("WEBSITE_PORT", 3000),
      jwtSecret: readOptionalEnv("ANALYTICS_JWT_SECRET"),
      corsOrigins: readCsvList("API_CORS_ORIGINS"),
      rateLimitPerMinute: readPositiveIntegerWithDefault("API_RATE_LIMIT_PER_MINUTE", 60),
    },
    logging: {
      streamJson: readBooleanWithDefault("LOG_STREAM_JSON", false),
    },
    llm: (() => {
      // LLM_ENABLED is the legacy master switch; the per-capability flags let a
      // constrained host run cheap embeddings without paying for generation.
      const master = readBooleanWithDefault("LLM_ENABLED", false);
      return {
        generationEnabled: readBooleanWithDefault("LLM_GENERATION_ENABLED", master),
        embeddingsEnabled: readBooleanWithDefault("LLM_EMBEDDINGS_ENABLED", master),
        baseUrl: readWithDefault("OLLAMA_BASE_URL", "http://localhost:11434"),
        model: readWithDefault("LLM_MODEL", "llama3.2:3b"),
        embedModel: readWithDefault("LLM_EMBED_MODEL", "nomic-embed-text"),
        timeoutMs: readPositiveIntegerWithDefault("LLM_TIMEOUT_MS", 20000),
        maxContextEntries: readPositiveIntegerWithDefault("LLM_MAX_CONTEXT_ENTRIES", 2),
        maxContextCharsPerEntry: readPositiveIntegerWithDefault(
          "LLM_MAX_CONTEXT_CHARS_PER_ENTRY",
          600,
        ),
      };
    })(),
    extensionRules: {
      maxStandardExtensions: readOptionalNonNegativeInteger("MAX_STANDARD_EXTENSIONS"),
      blockTimeLimitedAutoExtension: readBooleanWithDefault(
        "BLOCK_TIME_LIMITED_AUTO_EXTENSION",
        true,
      ),
    },
    reminders: {
      enabled: readBooleanWithDefault("REMINDERS_ENABLED", true),
      offsetMinutes: readReminderOffsetsWithDefault("REMINDER_OFFSETS_MINUTES", [1440, 360, 60, 0]),
      pollIntervalMs: readPositiveIntegerWithDefault("REMINDER_POLL_INTERVAL_MS", 30000),
      batchSize: readPositiveIntegerWithDefault("REMINDER_BATCH_SIZE", 25),
      lockDurationMs: readPositiveIntegerWithDefault("REMINDER_LOCK_DURATION_MS", 60000),
      maxAttempts: readPositiveIntegerWithDefault("REMINDER_MAX_ATTEMPTS", 5),
    },
  };
};
