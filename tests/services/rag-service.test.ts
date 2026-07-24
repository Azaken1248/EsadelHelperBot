import { describe, expect, it, vi } from "vitest";

import type { LlmClient } from "../../src/llm/llm-client";
import { KnowledgeService } from "../../src/services/knowledge-service";
import { RagService } from "../../src/services/rag-service";
import { createMockLogger } from "../helpers/mocks";

const knowledge = new KnowledgeService();

const makeLlm = (impl: Partial<LlmClient>): LlmClient => ({
  isEnabled: () => false,
  generate: async () => null,
  embed: async () => null,
  ...impl,
});

describe("RagService", () => {
  it("returns null when nothing in the knowledge base matches", async () => {
    const service = new RagService(knowledge, makeLlm({}), createMockLogger());
    expect(await service.ask("quarterly tax filing spreadsheet")).toBeNull();
  });

  it("returns retrieved text verbatim when the LLM is disabled", async () => {
    const generate = vi.fn();
    const service = new RagService(
      knowledge,
      makeLlm({ isEnabled: () => false, generate }),
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
      makeLlm({ isEnabled: () => true, generate }),
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
      makeLlm({ isEnabled: () => true, generate: async () => null }),
      createMockLogger(),
    );

    const answer = await service.ask("who is Ena?");
    expect(answer?.generated).toBe(false);
    expect(answer?.text.toLowerCase()).toContain("ena");
  });

  it("includes recent session turns in the prompt for continuity", async () => {
    const { MemoryService } = await import("../../src/services/memory-service");
    const { createInMemoryMemoryRepository } = await import("../helpers/mocks");
    const memoryService = new MemoryService(createInMemoryMemoryRepository(), createMockLogger());

    const generate = vi.fn().mockResolvedValue("Hehe, still Ena~ ♡");
    const service = new RagService(
      knowledge,
      makeLlm({ isEnabled: () => true, generate }),
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
