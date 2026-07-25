import { afterEach, describe, expect, it, vi } from "vitest";

import {
  OpenAiCompatibleLlmClient,
  type OpenAiCompatibleConfig,
} from "../../src/llm/openai-compatible-llm-client";
import { createMockLogger } from "../helpers/mocks";

const config = (overrides: Partial<OpenAiCompatibleConfig> = {}): OpenAiCompatibleConfig => ({
  generationEnabled: true,
  embeddingsEnabled: true,
  apiBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  apiKey: "test-key",
  model: "gemini-2.5-flash",
  embedModel: "text-embedding-004",
  timeoutMs: 5000,
  ...overrides,
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("OpenAiCompatibleLlmClient", () => {
  it("is disabled without an API key, and makes no network call", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const client = new OpenAiCompatibleLlmClient(config({ apiKey: null }), createMockLogger());

    expect(client.isGenerationEnabled()).toBe(false);
    expect(client.isEmbeddingsEnabled()).toBe(false);
    expect(await client.generate({ system: "s", prompt: "p" })).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts an OpenAI-shaped chat completion and returns the content", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "  Hi hi~! ♪  " } }] }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const client = new OpenAiCompatibleLlmClient(config(), createMockLogger());
    const result = await client.generate({ system: "sys", prompt: "hello" });

    expect(result).toBe("Hi hi~! ♪");
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("gemini-2.5-flash");
    expect(body.messages[0]).toMatchObject({ role: "system", content: "sys" });
    expect(body.messages[1]).toMatchObject({ role: "user", content: "hello" });
  });

  it("returns the embedding vector", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ embedding: [0.1, 0.2, 0.3] }] }),
      }),
    );

    const client = new OpenAiCompatibleLlmClient(config(), createMockLogger());
    expect(await client.embed("hello")).toEqual([0.1, 0.2, 0.3]);
  });

  it("returns null on a rate limit (429) so callers fall back", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) }));

    const client = new OpenAiCompatibleLlmClient(config(), createMockLogger());
    expect(await client.generate({ system: "s", prompt: "p" })).toBeNull();
    expect(await client.embed("x")).toBeNull();
  });

  it("returns null when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ENOTFOUND")));

    const client = new OpenAiCompatibleLlmClient(config(), createMockLogger());
    expect(await client.generate({ system: "s", prompt: "p" })).toBeNull();
  });

  it("tolerates a malformed response body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));

    const client = new OpenAiCompatibleLlmClient(config(), createMockLogger());
    expect(await client.generate({ system: "s", prompt: "p" })).toBeNull();
    expect(await client.embed("x")).toBeNull();
  });
});
