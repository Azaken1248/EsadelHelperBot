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
  };
  logging: {
    streamJson: boolean;
  };
  llm: {
    enabled: boolean;
    baseUrl: string;
    model: string;
    timeoutMs: number;
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
    },
    logging: {
      streamJson: readBooleanWithDefault("LOG_STREAM_JSON", false),
    },
    llm: {
      enabled: readBooleanWithDefault("LLM_ENABLED", false),
      baseUrl: readWithDefault("OLLAMA_BASE_URL", "http://localhost:11434"),
      model: readWithDefault("LLM_MODEL", "llama3.2:3b"),
      timeoutMs: readPositiveIntegerWithDefault("LLM_TIMEOUT_MS", 20000),
    },
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
