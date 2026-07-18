import { afterEach, describe, expect, it } from "vitest";

import { loadAppConfig } from "../../src/config/env";

const originalEnv = { ...process.env };

const setRequiredBaseEnv = () => {
  process.env.DISCORD_TOKEN = "token";
  process.env.DISCORD_APPLICATION_ID = "app-id";
  process.env.GUILD_ID = "guild-id";
  process.env.MONGODB_URI = "mongodb://localhost:27017/test";
};

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("loadAppConfig", () => {
  it("loads required values and reminder defaults", () => {
    setRequiredBaseEnv();

    const config = loadAppConfig();

    expect(config.discord.token).toBe("token");
    expect(config.discord.applicationId).toBe("app-id");
    expect(config.discord.guildId).toBe("guild-id");
    expect(config.mongo.uri).toBe("mongodb://localhost:27017/test");
    expect(config.channels.approvalChannelId).toBeNull();
    expect(config.channels.remindersChannelId).toBeNull();
    expect(config.channels.logsChannelId).toBeNull();
    expect(config.reminders.enabled).toBe(true);
    expect(config.reminders.offsetMinutes).toEqual([1440, 360, 60, 0]);
    expect(config.reminders.batchSize).toBe(25);
  });

  it("defaults Esadel-specific config to safe values", () => {
    setRequiredBaseEnv();

    const config = loadAppConfig();

    expect(config.channels.verificationChannelId).toBeNull();
    expect(config.roles.unverified).toBeNull();
    expect(config.roles.specialized).toEqual({});
    expect(config.captcha).toEqual({
      siteKey: null,
      secretKey: null,
      webPortalUrl: null,
    });
    expect(config.web.port).toBe(3000);
    expect(config.web.jwtSecret).toBeNull();
  });

  it("reads Esadel-specific env when configured", () => {
    setRequiredBaseEnv();
    process.env.VERIFICATION_CHANNEL_ID = "verify-channel";
    process.env.ROLE_UNVERIFIED_ID = "unverified-role";
    process.env.CAPTCHA_SITE_KEY = "site";
    process.env.CAPTCHA_SECRET_KEY = "secret";
    process.env.WEB_PORTAL_URL = "https://portal.example";
    process.env.WEBSITE_PORT = "4000";
    process.env.ANALYTICS_JWT_SECRET = "jwt";

    const config = loadAppConfig();

    expect(config.channels.verificationChannelId).toBe("verify-channel");
    expect(config.roles.unverified).toBe("unverified-role");
    expect(config.captcha.siteKey).toBe("site");
    expect(config.captcha.secretKey).toBe("secret");
    expect(config.captcha.webPortalUrl).toBe("https://portal.example");
    expect(config.web.port).toBe(4000);
    expect(config.web.jwtSecret).toBe("jwt");
  });

  it("reads optional channel ids when configured", () => {
    setRequiredBaseEnv();
    process.env.APPROVAL_CHANNEL_ID = "approval-channel";
    process.env.REMINDERS_CHANNEL_ID = "reminders-channel";
    process.env.LOGS_CHANNEL_ID = "logs-channel";

    const config = loadAppConfig();

    expect(config.channels.approvalChannelId).toBe("approval-channel");
    expect(config.channels.remindersChannelId).toBe("reminders-channel");
    expect(config.channels.logsChannelId).toBe("logs-channel");
  });

  it("uses DISCORD_GUILD_ID when provided", () => {
    setRequiredBaseEnv();
    process.env.DISCORD_GUILD_ID = "guild-id-override";

    const config = loadAppConfig();

    expect(config.discord.guildId).toBe("guild-id-override");
  });

  it("parses and deduplicates reminder offsets", () => {
    setRequiredBaseEnv();
    process.env.REMINDER_OFFSETS_MINUTES = " 30, 0, 30, 120";

    const config = loadAppConfig();

    expect(config.reminders.offsetMinutes).toEqual([120, 30, 0]);
  });

  it("throws on invalid reminder offset value", () => {
    setRequiredBaseEnv();
    process.env.REMINDER_OFFSETS_MINUTES = "30,abc";

    expect(() => loadAppConfig()).toThrowError(
      "REMINDER_OFFSETS_MINUTES must be a comma-separated list of non-negative integers.",
    );
  });

  it("throws when required env is missing", () => {
    process.env = {};

    expect(() => loadAppConfig()).toThrowError(
      "Missing required environment variable: GUILD_ID",
    );
  });
});
