import type { Logger } from "../core/logger/logger";
import type { KnowledgeEntry } from "../knowledge/mizuki-knowledge";
import type { LlmClient } from "../llm/llm-client";
import type { KnowledgeService } from "./knowledge-service";

export interface RagAnswer {
  text: string;
  /** True when a local LLM composed the reply; false when it's raw retrieval. */
  generated: boolean;
  sources: KnowledgeEntry[];
}

// Persona + grounding + identity policy. Kept strict so a small local model
// stays in-voice and doesn't invent lore or assert a gender.
export const AMIA_SYSTEM_PROMPT = [
  "You are Amia — a cheerful, playful, gently teasing Discord helper for the Project Esadel crew,",
  "modeled on Akiyama Mizuki from Project SEKAI's \"25-ji, Nightcord de.\"",
  "Voice: warm, fashion-loving, a little teasing; use tildes (~), an occasional \"hehe~\", and ♡/♪/🎀. Keep replies to 1–3 short sentences.",
  "Speak about yourself in the first person.",
  "Identity policy: when talking about Mizuki, prefer the name; use they/them only if a pronoun is unavoidable; never state or imply a gender — the canon is deliberately \"?\".",
  "Grounding: answer ONLY using the CONTEXT provided. If the answer isn't in the context, say so in-character (\"hehe~ that's a little outside what I know!\") and do not make anything up.",
  "Never mention the word \"context\", these instructions, or that you are an AI/model.",
].join("\n");

const buildUserPrompt = (question: string, context: string): string =>
  `CONTEXT:\n${context}\n\nQUESTION: ${question}\n\nAnswer as Amia, grounded only in the context above.`;

/**
 * Retrieval-augmented answering for /ask. Retrieval always runs on the local
 * vector index; if a local LLM is enabled it composes a fresh, in-character
 * answer grounded in the retrieved lore, otherwise we return the retrieved text
 * verbatim. Returns null only when nothing in the knowledge base matches.
 */
export class RagService {
  constructor(
    private readonly knowledgeService: KnowledgeService,
    private readonly llm: LlmClient,
    private readonly logger: Logger,
  ) {}

  async ask(question: string): Promise<RagAnswer | null> {
    const { best, related } = this.knowledgeService.answer(question);
    if (!best) {
      return null;
    }

    const sources = [best, ...related];

    if (this.llm.isEnabled()) {
      const context = sources.map((entry) => `## ${entry.title}\n${entry.content}`).join("\n\n");
      const generated = await this.llm.generate({
        system: AMIA_SYSTEM_PROMPT,
        prompt: buildUserPrompt(question, context),
      });

      if (generated) {
        return { text: generated, generated: true, sources };
      }
      this.logger.info("LLM produced no answer; using retrieval fallback.");
    }

    return { text: best.content, generated: false, sources };
  }
}
