import { describe, expect, it, vi } from "vitest";

import type { LlmClient } from "../../src/llm/llm-client";
import { KnowledgeService } from "../../src/services/knowledge-service";
import { RagService } from "../../src/services/rag-service";
import { createMockLogger } from "../helpers/mocks";

const knowledge = new KnowledgeService();

const makeLlm = (impl: Partial<LlmClient>): LlmClient => ({
  isGenerationEnabled: () => false,
  isEmbeddingsEnabled: () => false,
  generate: async () => null,
  embed: async () => null,
  ...impl,
});

describe("RagService", () => {
  it("returns null on no match when generation is unavailable", async () => {
    const service = new RagService(knowledge, makeLlm({}), createMockLogger());
    expect(await service.ask("quarterly tax filing spreadsheet")).toBeNull();
  });

  it("answers conversationally (ungrounded) on no match when generation is on", async () => {
    const generate = vi.fn().mockResolvedValue("Hehe~ no idea about that one! ♪");
    const service = new RagService(
      knowledge,
      makeLlm({ isGenerationEnabled: () => true, generate }),
      createMockLogger(),
    );

    const answer = await service.ask("quarterly tax filing spreadsheet");

    expect(answer?.generated).toBe(true);
    expect(answer?.sources).toEqual([]); // nothing to cite
    // must be told it has no lore, and forbidden from inventing any
    const { system } = generate.mock.calls[0][0];
    expect(system).toContain("NO lore context");
    expect(system).toContain("do NOT state any specific facts");
  });

  it("still returns null on no match if the ungrounded generation also fails", async () => {
    const service = new RagService(
      knowledge,
      makeLlm({ isGenerationEnabled: () => true, generate: async () => null }),
      createMockLogger(),
    );
    expect(await service.ask("quarterly tax filing spreadsheet")).toBeNull();
  });

  it("matches natural self-referential questions", async () => {
    for (const q of ["who are you", "tell me about yourself", "what do you do"]) {
      const service = new RagService(knowledge, makeLlm({}), createMockLogger());
      const answer = await service.ask(q);
      expect(answer, `expected a match for "${q}"`).not.toBeNull();
    }
  });

  it("returns retrieved text verbatim when the LLM is disabled", async () => {
    const generate = vi.fn();
    const service = new RagService(
      knowledge,
      makeLlm({ isGenerationEnabled: () => false, generate }),
      createMockLogger(),
    );

    const answer = await service.ask("who is Ena?");
    expect(answer?.generated).toBe(false);
    expect(answer?.text.toLowerCase()).toContain("ena");
    expect(answer?.sources.length).toBeGreaterThan(0);
    expect(generate).not.toHaveBeenCalled();
  });

  it("uses the LLM answer, grounded in retrieved sources, when enabled", async () => {
    const generate = vi.fn().mockResolvedValue("Ena's my closest friend~ ♡");
    const service = new RagService(
      knowledge,
      makeLlm({ isGenerationEnabled: () => true, generate }),
      createMockLogger(),
    );

    const answer = await service.ask("who is Ena?");
    expect(answer?.generated).toBe(true);
    expect(answer?.text).toBe("Ena's my closest friend~ ♡");

    // The prompt must include the retrieved lore as grounding context.
    const { system, prompt } = generate.mock.calls[0][0];
    expect(system).toContain("Amia");
    expect(prompt.toLowerCase()).toContain("ena");
  });

  it("falls back to retrieval when the LLM returns nothing", async () => {
    const service = new RagService(
      knowledge,
      makeLlm({ isGenerationEnabled: () => true, generate: async () => null }),
      createMockLogger(),
    );

    const answer = await service.ask("who is Ena?");
    expect(answer?.generated).toBe(false);
    expect(answer?.text.toLowerCase()).toContain("ena");
  });

  it("caps grounding context by entry count and length (cheap prompts on weak CPUs)", async () => {
    const generate = vi.fn().mockResolvedValue("ok~");
    const service = new RagService(
      knowledge,
      makeLlm({ isGenerationEnabled: () => true, generate }),
      createMockLogger(),
      undefined,
      undefined,
      { maxEntries: 1, maxCharsPerEntry: 80 },
    );

    await service.ask("who is Ena?");

    const prompt = generate.mock.calls[0][0].prompt as string;
    const context = prompt.split("CONTEXT:\n")[1]!.split("\n\nQUESTION:")[0]!;
    expect(context.split("## ").filter(Boolean)).toHaveLength(1); // only one entry
    expect(context).toContain("…"); // long entry was truncated
    expect(context.length).toBeLessThan(200);
  });

  it("includes recent session turns in the prompt for continuity", async () => {
    const { MemoryService } = await import("../../src/services/memory-service");
    const { createInMemoryMemoryRepository } = await import("../helpers/mocks");
    const memoryService = new MemoryService(createInMemoryMemoryRepository(), createMockLogger());

    const generate = vi.fn().mockResolvedValue("Hehe, still Ena~ ♡");
    const service = new RagService(
      knowledge,
      makeLlm({ isGenerationEnabled: () => true, generate }),
      createMockLogger(),
      memoryService,
    );

    await service.ask("who is Ena?", "u1");
    await service.ask("what about the songs?", "u1");

    const secondPrompt = generate.mock.calls[1][0].prompt as string;
    expect(secondPrompt).toContain("RECENT CONVERSATION");
    expect(secondPrompt).toContain("who is Ena?");
  });
});
