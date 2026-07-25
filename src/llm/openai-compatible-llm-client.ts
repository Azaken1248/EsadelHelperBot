import type { Logger } from "../core/logger/logger";
import type { LlmClient, LlmGenerateInput } from "./llm-client";

export interface OpenAiCompatibleConfig {
  generationEnabled: boolean;
  embeddingsEnabled: boolean;
  /** Base URL ending at the version segment, e.g. ".../v1beta/openai" or ".../openai/v1". */
  apiBaseUrl: string;
  apiKey: string | null;
  model: string;
  embedModel: string;
  timeoutMs: number;
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

interface EmbeddingsResponse {
  data?: { embedding?: number[] }[];
}

/**
 * Client for any OpenAI-compatible chat/embeddings API — Google Gemini (via its
 * OpenAI compatibility endpoint), Groq, OpenRouter, Cerebras, GitHub Models, etc.
 *
 * Same contract as the Ollama client: every failure (disabled, missing key,
 * rate limit, timeout, malformed body) resolves to null so callers fall back to
 * deterministic behaviour instead of breaking.
 */
export class OpenAiCompatibleLlmClient implements LlmClient {
  constructor(
    private readonly config: OpenAiCompatibleConfig,
    private readonly logger: Logger,
  ) {}

  isGenerationEnabled(): boolean {
    return this.config.generationEnabled && this.config.apiKey !== null;
  }

  isEmbeddingsEnabled(): boolean {
    return this.config.embeddingsEnabled && this.config.apiKey !== null;
  }

  private endpoint(path: string): string {
    return `${this.config.apiBaseUrl.replace(/\/+$/, "")}${path}`;
  }

  private async post<T>(path: string, body: unknown, label: string): Promise<T | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(this.endpoint(path), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey ?? ""}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        // 429 is the common free-tier outcome; treat it like any other failure.
        this.logger.warn(`Remote ${label} returned a non-OK status.`, {
          status: response.status,
          model: this.config.model,
        });
        return null;
      }

      return (await response.json()) as T;
    } catch (error) {
      this.logger.warn(`Remote ${label} request failed; falling back.`, {
        message: error instanceof Error ? error.message : "Unknown error.",
      });
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  async generate({ system, prompt, options }: LlmGenerateInput): Promise<string | null> {
    if (!this.isGenerationEnabled()) {
      return null;
    }

    const json = await this.post<ChatCompletionResponse>(
      "/chat/completions",
      {
        model: this.config.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 320,
      },
      "LLM",
    );

    const content = json?.choices?.[0]?.message?.content?.trim();
    return content && content.length > 0 ? content : null;
  }

  async embed(text: string): Promise<number[] | null> {
    if (!this.isEmbeddingsEnabled()) {
      return null;
    }

    const json = await this.post<EmbeddingsResponse>(
      "/embeddings",
      { model: this.config.embedModel, input: text },
      "embedding model",
    );

    const embedding = json?.data?.[0]?.embedding;
    return Array.isArray(embedding) && embedding.length > 0 ? embedding : null;
  }
}
