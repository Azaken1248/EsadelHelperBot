import { describe, expect, it, vi } from "vitest";

import { createLogger, isLogSinkRegistrar } from "../../src/core/logger/logger";

describe("createLogger", () => {
  it("supports sink registration and forwards entries", async () => {
    const logger = createLogger("TestScope");

    expect(isLogSinkRegistrar(logger)).toBe(true);

    if (!isLogSinkRegistrar(logger)) {
      throw new Error("Logger should support sink registration.");
    }

    const sink = vi.fn().mockResolvedValue(undefined);
    logger.registerSink(sink);

    logger.info("hello", { a: 1 });

    await vi.waitFor(() => {
      expect(sink).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: "TestScope",
          level: "INFO",
          message: "hello",
          metadata: { a: 1 },
        }),
      );
    });
  });

  it("keeps logging even if sink throws", async () => {
    const logger = createLogger("TestScope");

    if (!isLogSinkRegistrar(logger)) {
      throw new Error("Logger should support sink registration.");
    }

    const failingSink = vi.fn().mockRejectedValue(new Error("sink failed"));
    logger.registerSink(failingSink);

    expect(() => logger.warn("warn message")).not.toThrow();

    await vi.waitFor(() => {
      expect(failingSink).toHaveBeenCalledTimes(1);
    });
  });
});
