import { describe, expect, it, vi } from "vitest";

import { LogBroadcaster } from "../../src/core/logger/log-broadcaster";
import type { LogEntry } from "../../src/core/logger/logger";

const entry = (message: string): LogEntry => ({
  timestamp: new Date().toISOString(),
  level: "INFO",
  scope: "Test",
  message,
});

describe("LogBroadcaster", () => {
  it("forwards entries fed through the sink to subscribers", () => {
    const broadcaster = new LogBroadcaster();
    const listener = vi.fn();
    broadcaster.subscribe(listener);

    broadcaster.sink(entry("hello"));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toMatchObject({ message: "hello" });
  });

  it("replays recent entries oldest-first and caps the ring buffer", () => {
    const broadcaster = new LogBroadcaster(3);
    for (const message of ["a", "b", "c", "d"]) {
      broadcaster.publish(entry(message));
    }

    const recent = broadcaster.recent();
    expect(recent.map((item) => item.message)).toEqual(["b", "c", "d"]);
  });

  it("stops delivering after unsubscribe", () => {
    const broadcaster = new LogBroadcaster();
    const listener = vi.fn();
    const unsubscribe = broadcaster.subscribe(listener);

    broadcaster.publish(entry("one"));
    unsubscribe();
    broadcaster.publish(entry("two"));

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
