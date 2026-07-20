import type { Logger } from "../core/logger/logger";

export interface LlmGenerateInput {
  system: string;
  prompt: string;
}

export interface LlmClient {
  isEnabled(): boolean;
  generate(input: LlmGenerateInput): Promise<string | null>;
}

export interface LlmConfig {
  enabled: boolean;
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

interface OllamaChatResponse {
  message?: { content?: string };
}

/**
 * Thin client for a **local** Ollama server (no external API, no cost). The
 * operator runs Ollama separately; the bot only makes HTTP calls. Every failure
 * (disabled, unreachable, timeout, bad model) resolves to null so callers can
 * fall back to plain retrieval — /ask never breaks.
 */
export class OllamaLlmClient implements LlmClient {
  constructor(
    private readonly config: LlmConfig,
    private readonly logger: Logger,
  ) {}

  isEnabled(): boolean {
    return this.config.enabled;
  }

  async generate({ system, prompt }: LlmGenerateInput): Promise<string | null> {
    if (!this.config.enabled) {
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.config.baseUrl.replace(/\/+$/, "")}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.config.model,
          stream: false,
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
          options: { temperature: 0.7, num_predict: 320 },
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
}
