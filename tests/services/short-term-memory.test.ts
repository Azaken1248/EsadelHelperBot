import { describe, expect, it } from "vitest";

import { ShortTermMemory } from "../../src/services/short-term-memory";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("ShortTermMemory", () => {
  it("keeps the most recent turns up to the cap, in order", () => {
    const stm = new ShortTermMemory(3);
    stm.remember("u1", "user", "one");
    stm.remember("u1", "amia", "two");
    stm.remember("u1", "user", "three");
    stm.remember("u1", "amia", "four");

    const turns = stm.recent("u1");
    expect(turns.map((t) => t.text)).toEqual(["two", "three", "four"]);
  });

  it("isolates users and clears on demand", () => {
    const stm = new ShortTermMemory();
    stm.remember("u1", "user", "hello");
    stm.remember("u2", "user", "other");

    stm.clear("u1");
    expect(stm.recent("u1")).toEqual([]);
    expect(stm.recent("u2")).toHaveLength(1);
  });

  it("expires a session after the idle TTL", async () => {
    const stm = new ShortTermMemory(8, 1); // 1 ms TTL
    stm.remember("u1", "user", "hello");
    await sleep(10);
    expect(stm.recent("u1")).toEqual([]);
  });

  it("evicts the oldest session when the user cap is exceeded", () => {
    const stm = new ShortTermMemory(8, 60_000, 2);
    stm.remember("u1", "user", "a");
    stm.remember("u2", "user", "b");
    stm.remember("u3", "user", "c");

    expect(stm.recent("u1")).toEqual([]); // oldest evicted
    expect(stm.recent("u2")).toHaveLength(1);
    expect(stm.recent("u3")).toHaveLength(1);
  });
});
