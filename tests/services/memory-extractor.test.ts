import { describe, expect, it, vi } from "vitest";

import type { KnowledgeEntry } from "../../src/knowledge/mizuki-knowledge";
import type { LlmClient } from "../../src/llm/llm-client";
import { MemoryExtractor } from "../../src/services/memory-extractor";
import { createMockLogger } from "../helpers/mocks";

const entry = { title: "Shinonome Ena" } as KnowledgeEntry;

const makeLlm = (impl: Partial<LlmClient>): LlmClient => ({
  isGenerationEnabled: () => true,
  isEmbeddingsEnabled: () => true,
  generate: async () => null,
  embed: async () => null,
  ...impl,
});

describe("MemoryExtractor", () => {
  it("falls back to deterministic extraction when the LLM is disabled", async () => {
    const generate = vi.fn();
    const extractor = new MemoryExtractor(
      makeLlm({ isGenerationEnabled: () => false, generate }),
      createMockLogger(),
    );

    const result = await extractor.extract("q", "a", entry);
    expect(result).toEqual([{ text: "Curious about Shinonome Ena", kind: "interest" }]);
    expect(generate).not.toHaveBeenCalled();
  });

  it("falls back when the LLM returns nothing (not running)", async () => {
    const extractor = new MemoryExtractor(
      makeLlm({ generate: async () => null }),
      createMockLogger(),
    );

    const result = await extractor.extract("q", "a", entry);
    expect(result).toEqual([{ text: "Curious about Shinonome Ena", kind: "interest" }]);
  });

  it("falls back when the LLM output is unparseable", async () => {
    const extractor = new MemoryExtractor(
      makeLlm({ generate: async () => "sorry, I can't do that" }),
      createMockLogger(),
    );

    const result = await extractor.extract("q", "a", entry);
    expect(result).toEqual([{ text: "Curious about Shinonome Ena", kind: "interest" }]);
  });

  it("parses valid LLM output, capping at two candidates", async () => {
    const raw =
      'Here you go: [{"text":"Loves Ena lore","kind":"interest"},{"text":"Prefers short answers","kind":"preference"},{"text":"Third one","kind":"fact"}]';
    const extractor = new MemoryExtractor(makeLlm({ generate: async () => raw }), createMockLogger());

    const result = await extractor.extract("q", "a", entry);
    expect(result).toEqual([
      { text: "Loves Ena lore", kind: "interest" },
      { text: "Prefers short answers", kind: "preference" },
    ]);
  });

  it("respects an intentionally empty array (nothing worth remembering)", async () => {
    const extractor = new MemoryExtractor(makeLlm({ generate: async () => "[]" }), createMockLogger());
    expect(await extractor.extract("q", "a", entry)).toEqual([]);
  });

  it("filters invalid kinds and PII-looking candidates", async () => {
    const raw =
      '[{"text":"Phone is 5551234567","kind":"fact"},{"text":"Weird","kind":"banana"},{"text":"Likes teasing banter","kind":"style"}]';
    const extractor = new MemoryExtractor(makeLlm({ generate: async () => raw }), createMockLogger());

    const result = await extractor.extract("q", "a", entry);
    expect(result).toEqual([{ text: "Likes teasing banter", kind: "style" }]);
  });
});
