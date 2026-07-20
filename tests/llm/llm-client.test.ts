import { afterEach, describe, expect, it, vi } from "vitest";

import { OllamaLlmClient, type LlmConfig } from "../../src/llm/llm-client";
import { createMockLogger } from "../helpers/mocks";

const config = (overrides: Partial<LlmConfig> = {}): LlmConfig => ({
  enabled: true,
  baseUrl: "http://localhost:11434",
  model: "llama3.2:3b",
  timeoutMs: 5000,
  ...overrides,
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("OllamaLlmClient", () => {
  it("returns null immediately when disabled (no network call)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const client = new OllamaLlmClient(config({ enabled: false }), createMockLogger());
    expect(client.isEnabled()).toBe(false);
    expect(await client.generate({ system: "s", prompt: "p" })).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts to Ollama /api/chat and returns the message content", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: "  Hi hi~! ♪  " } }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const client = new OllamaLlmClient(config(), createMockLogger());
    const result = await client.generate({ system: "sys", prompt: "hello" });

    expect(result).toBe("Hi hi~! ♪");
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://localhost:11434/api/chat");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("llama3.2:3b");
    expect(body.stream).toBe(false);
    expect(body.messages[0]).toMatchObject({ role: "system", content: "sys" });
  });

  it("returns null on a non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    const client = new OllamaLlmClient(config(), createMockLogger());
    expect(await client.generate({ system: "s", prompt: "p" })).toBeNull();
  });

  it("returns null when the request throws (unreachable/timeout)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const client = new OllamaLlmClient(config(), createMockLogger());
    expect(await client.generate({ system: "s", prompt: "p" })).toBeNull();
  });
});
