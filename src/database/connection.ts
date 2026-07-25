import mongoose from "mongoose";

import type { Logger } from "../core/logger/logger";

export interface ConnectOptions {
  /** Total connection attempts before giving up. */
  maxAttempts?: number;
  /** Delay before the first retry; doubles each attempt (capped). */
  initialDelayMs?: number;
  maxDelayMs?: number;
}

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_INITIAL_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 30000;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Connects to MongoDB with exponential backoff. Transient failures (network
 * blips, a dynamic IP that hasn't propagated to the Atlas allow-list, a DB
 * still booting) shouldn't kill startup, so we retry before surfacing the error.
 * Mongoose handles reconnection on its own once the initial connection is up.
 */
export const connectToDatabase = async (
  mongoUri: string,
  logger: Logger,
  options: ConnectOptions = {},
): Promise<void> => {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const initialDelayMs = options.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;

  let delayMs = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await mongoose.connect(mongoUri);
      logger.info("Connected to MongoDB.", { attempt });
      registerConnectionListeners(logger);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown MongoDB connection error.";

      if (attempt === maxAttempts) {
        logger.error("Could not connect to MongoDB; giving up.", { attempt, message });
        throw error;
      }

      logger.warn("MongoDB connection failed; retrying.", {
        attempt,
        maxAttempts,
        retryInMs: delayMs,
        message,
      });

      await sleep(delayMs);
      delayMs = Math.min(delayMs * 2, maxDelayMs);
    }
  }
};

/** Surfaces mid-session drops/recoveries; Mongoose retries these itself. */
const registerConnectionListeners = (logger: Logger): void => {
  const connection = mongoose.connection;
  if (connection.listenerCount("disconnected") > 0) {
    return; // already registered
  }

  connection.on("disconnected", () => {
    logger.warn("MongoDB disconnected; driver will attempt to reconnect.");
  });
  connection.on("reconnected", () => {
    logger.info("MongoDB reconnected.");
  });
  connection.on("error", (error: unknown) => {
    logger.error("MongoDB connection error.", {
      message: error instanceof Error ? error.message : "Unknown error.",
    });
  });
};

export const disconnectFromDatabase = async (logger: Logger): Promise<void> => {
  await mongoose.disconnect();
  logger.info("Disconnected from MongoDB.");
};
