import { afterEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";

import { connectToDatabase } from "../../src/database/connection";
import { createMockLogger } from "../helpers/mocks";

afterEach(() => {
  vi.restoreAllMocks();
});

const fastRetries = { initialDelayMs: 1, maxDelayMs: 2 };

describe("connectToDatabase", () => {
  it("connects on the first attempt", async () => {
    const connect = vi.spyOn(mongoose, "connect").mockResolvedValue(mongoose);
    const logger = createMockLogger();

    await connectToDatabase("mongodb://localhost/test", logger, fastRetries);

    expect(connect).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith("Connected to MongoDB.", { attempt: 1 });
  });

  it("retries transient failures with backoff, then succeeds", async () => {
    const connect = vi
      .spyOn(mongoose, "connect")
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockRejectedValueOnce(new Error("IP not in allow-list"))
      .mockResolvedValue(mongoose);
    const logger = createMockLogger();

    await connectToDatabase("mongodb://localhost/test", logger, fastRetries);

    expect(connect).toHaveBeenCalledTimes(3);
    expect(logger.warn).toHaveBeenCalledTimes(2); // one warning per retry
  });

  it("gives up after maxAttempts and rethrows", async () => {
    const connect = vi.spyOn(mongoose, "connect").mockRejectedValue(new Error("still down"));
    const logger = createMockLogger();

    await expect(
      connectToDatabase("mongodb://localhost/test", logger, { ...fastRetries, maxAttempts: 3 }),
    ).rejects.toThrow("still down");

    expect(connect).toHaveBeenCalledTimes(3);
    expect(logger.error).toHaveBeenCalled();
  });
});
