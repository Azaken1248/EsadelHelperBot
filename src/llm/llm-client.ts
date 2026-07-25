import type { Logger } from "../core/logger/logger";

export interface LlmGenerateInput {
  system: string;
  prompt: string;
  options?: {
    temperature?: number;
    maxTokens?: number;
  };
}

export interface LlmClient {
  /** Text generation available? (expensive on CPU) */
  isGenerationEnabled(): boolean;
  /** Embeddings available? (cheap — a single forward pass) */
  isEmbeddingsEnabled(): boolean;
  generate(input: LlmGenerateInput): Promise<string | null>;
  /** Embed text into a vector via the local embedding model; null on any failure. */
  embed(text: string): Promise<number[] | null>;
}

export interface LlmConfig {
  generationEnabled: boolean;
  embeddingsEnabled: boolean;
  baseUrl: string;
  model: string;
  embedModel: string;
  timeoutMs: number;
}

interface OllamaChatResponse {
  message?: { content?: string };
}

interface OllamaEmbeddingResponse {
  embedding?: number[];
}

/**
 * Thin client for a **local** Ollama server (no external API, no cost). The
 * operator runs Ollama separately; the bot only makes HTTP calls. Every failure
 * (disabled, unreachable, timeout, bad model) resolves to null so callers can
 * fall back to deterministic behavior — nothing user-facing ever breaks.
 */
export class OllamaLlmClient implements LlmClient {
  constructor(
    private readonly config: LlmConfig,
    private readonly logger: Logger,
  ) {}

  isGenerationEnabled(): boolean {
    return this.config.generationEnabled;
  }

  isEmbeddingsEnabled(): boolean {
    return this.config.embeddingsEnabled;
  }

  private baseUrl(): string {
    return this.config.baseUrl.replace(/\/+$/, "");
  }

  async generate({ system, prompt, options }: LlmGenerateInput): Promise<string | null> {
    if (!this.config.generationEnabled) {
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl()}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.config.model,
          stream: false,
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
          options: {
            temperature: options?.temperature ?? 0.7,
            num_predict: options?.maxTokens ?? 320,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        this.logger.warn("Local LLM returned a non-OK status.", {
          status: response.status,
          model: this.config.model,
        });
        return null;
      }

      const json = (await response.json()) as OllamaChatResponse;
      const content = json.message?.content?.trim();
      return content && content.length > 0 ? content : null;
    } catch (error) {
      this.logger.warn("Local LLM request failed; falling back to retrieval.", {
        message: error instanceof Error ? error.message : "Unknown LLM error.",
      });
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  async embed(text: string): Promise<number[] | null> {
    if (!this.config.embeddingsEnabled) {
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl()}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.config.embedModel,
          prompt: text,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        this.logger.warn("Local embedding model returned a non-OK status.", {
          status: response.status,
          model: this.config.embedModel,
        });
        return null;
      }

      const json = (await response.json()) as OllamaEmbeddingResponse;
      const embedding = json.embedding;
      return Array.isArray(embedding) && embedding.length > 0 ? embedding : null;
    } catch (error) {
      this.logger.warn("Local embedding request failed; falling back to keyword matching.", {
        message: error instanceof Error ? error.message : "Unknown embedding error.",
      });
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
