import { describe, expect, it } from "vitest";

import type { KnowledgeEntry } from "../../src/knowledge/mizuki-knowledge";
import { MemoryService } from "../../src/services/memory-service";
import { createInMemoryMemoryRepository, createMockLogger } from "../helpers/mocks";

const makeService = () => {
  const repo = createInMemoryMemoryRepository();
  return { service: new MemoryService(repo, createMockLogger()), repo };
};

describe("MemoryService", () => {
  it("stores distinct memories and reinforces duplicates", async () => {
    const { service, repo } = makeService();

    await service.remember("u1", [{ text: "Curious about Ena", kind: "interest" }]);
    await service.remember("u1", [{ text: "Curious about Ena", kind: "interest" }]);
    await service.remember("u1", [{ text: "Curious about songs", kind: "interest" }]);

    const all = await repo.findByUser("u1");
    expect(all).toHaveLength(2);
    const ena = all.find((m) => m.text === "Curious about Ena")!;
    expect(ena.strength).toBe(2); // reinforced
  });

  it("recall ranks relevant + activated memories and reinforces them", async () => {
    const { service } = makeService();
    await service.remember("u1", [
      { text: "Curious about Shinonome Ena", kind: "interest" },
      { text: "Curious about the songs", kind: "interest" },
    ]);

    const recalled = await service.recall("u1", "tell me about ena", 5);
    expect(recalled[0]?.text).toContain("Ena");
    // recall reinforces refCount of surfaced memories
    expect(recalled[0]?.refCount).toBe(1);
  });

  it("list orders by activation (most reinforced first)", async () => {
    const { service } = makeService();
    await service.remember("u1", [{ text: "Curious about Ena", kind: "interest" }]);
    await service.remember("u1", [{ text: "Curious about Ena", kind: "interest" }]);
    await service.remember("u1", [{ text: "Curious about Rui", kind: "interest" }]);

    const list = await service.list("u1");
    expect(list[0]?.text).toContain("Ena");
  });

  it("forget wipes only that user's memories", async () => {
    const { service } = makeService();
    await service.remember("u1", [{ text: "Curious about Ena", kind: "interest" }]);
    await service.remember("u2", [{ text: "Curious about Rui", kind: "interest" }]);

    const removed = await service.forget("u1");
    expect(removed).toBe(1);
    expect(await service.list("u1")).toHaveLength(0);
    expect(await service.list("u2")).toHaveLength(1);
  });

  it("extracts an interest memory from a matched lore entry", () => {
    const { service } = makeService();
    const entry = { title: "Shinonome Ena" } as KnowledgeEntry;
    const candidates = service.extractFromLoreMatch(entry);
    expect(candidates[0]).toMatchObject({ kind: "interest", text: "Curious about Shinonome Ena" });
  });
});
