import { describe, expect, it } from "vitest";

import type { KnowledgeEntry } from "../../src/knowledge/mizuki-knowledge";
import type { LlmClient } from "../../src/llm/llm-client";
import { MemoryService } from "../../src/services/memory-service";
import { ShortTermMemory } from "../../src/services/short-term-memory";
import { createInMemoryMemoryRepository, createMockLogger } from "../helpers/mocks";

const makeService = (llm?: LlmClient) => {
  const repo = createInMemoryMemoryRepository();
  const stm = new ShortTermMemory();
  return {
    service: new MemoryService(repo, createMockLogger(), llm, stm),
    repo,
    stm,
  };
};

/** Fake embedder mapping "ena"/"bestie" to one axis and everything else to the other. */
const makeEmbeddingLlm = (): LlmClient => ({
  isGenerationEnabled: () => true,
  isEmbeddingsEnabled: () => true,
  generate: async () => null,
  embed: async (text: string) =>
    /ena|bestie/i.test(text) ? [1, 0] : [0, 1],
});

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

  it("uses semantic (embedding) relevance when the embedder is available", async () => {
    const { service } = makeService(makeEmbeddingLlm());
    // "bestie" shares no keywords with either memory; only embeddings can match it to Ena.
    await service.remember("u1", [
      { text: "Ena admirer", kind: "interest" },
      { text: "Song lover", kind: "interest" },
    ]);

    const recalled = await service.recall("u1", "who is the bestie", 1);
    expect(recalled[0]?.text).toBe("Ena admirer");
  });

  it("falls back to keyword overlap when the embedder is unavailable", async () => {
    const { service } = makeService(); // no LLM at all
    await service.remember("u1", [
      { text: "Curious about Shinonome Ena", kind: "interest" },
      { text: "Curious about the songs", kind: "interest" },
    ]);

    const recalled = await service.recall("u1", "tell me about ena", 5);
    expect(recalled[0]?.text).toContain("Ena");
  });

  it("prunes memories whose activation decayed below the floor", async () => {
    const { service, repo } = makeService();
    await service.remember("u1", [
      { text: "Curious about Ena", kind: "interest" },
      { text: "Stale one", kind: "interest" },
    ]);

    // Age the stale memory ~100 days with no refs: activation ≈ e^-5 < floor.
    const all = await repo.findByUser("u1");
    const stale = all.find((m) => m.text === "Stale one")!;
    stale.lastReferencedAt = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);

    const listed = await service.list("u1");
    expect(listed.map((m) => m.text)).toEqual(["Curious about Ena"]);
    expect(await repo.findByUser("u1")).toHaveLength(1); // hard-deleted
  });

  it("keeps referenced memories forever regardless of age", async () => {
    const { service, repo } = makeService();
    await service.remember("u1", [{ text: "Curious about Ena", kind: "interest" }]);

    const all = await repo.findByUser("u1");
    all[0]!.refCount = 3; // has surfaced before
    all[0]!.lastReferencedAt = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    const listed = await service.list("u1");
    expect(listed).toHaveLength(1);
  });

  it("tracks session turns and forget() clears both stores", async () => {
    const { service, stm } = makeService();
    await service.remember("u1", [{ text: "Curious about Ena", kind: "interest" }]);
    service.rememberTurn("u1", "user", "who is Ena?");
    service.rememberTurn("u1", "amia", "My closest friend~");

    expect(service.recentTurns("u1")).toHaveLength(2);

    await service.forget("u1");
    expect(await service.list("u1")).toHaveLength(0);
    expect(stm.recent("u1")).toEqual([]);
  });
});
