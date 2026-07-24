import type { Logger } from "../core/logger/logger";
import type { KnowledgeEntry } from "../knowledge/mizuki-knowledge";
import type { LlmClient } from "../llm/llm-client";
import type { MemoryKind } from "../models/memory.model";
import type { MemoryCandidate } from "./memory-service";

const VALID_KINDS: ReadonlySet<string> = new Set(["interest", "preference", "fact", "style"]);
const MAX_CANDIDATES = 2;
const MAX_TEXT_LENGTH = 120;
// Cheap PII guard on top of the prompt rules: no long digit runs (IDs, phone
// numbers) and no credential-looking notes make it into storage.
const PII_PATTERN = /\d{7,}|password|passwd|token|secret/i;

const EXTRACTION_SYSTEM_PROMPT = [
  "You maintain tiny memory notes about a Discord user for the assistant Amia.",
  `From the exchange, extract at most ${MAX_CANDIDATES} short notes about the USER themself — their interests, preferences, or how they like to talk.`,
  "Rules: write in third person, at most 12 words per note; only stable, user-specific information; never quote the messages verbatim; never store names of other people, IDs, contact details, or anything sensitive; if nothing is worth remembering, return an empty array.",
  'Respond with ONLY a JSON array, e.g. [{"text":"Loves Ena lore","kind":"interest"}].',
  'Allowed kinds: "interest", "preference", "fact", "style".',
].join("\n");

/**
 * Distills durable memories from an /ask exchange. Uses the local LLM when
 * available (the richer path); on any failure — disabled, unreachable, invalid
 * JSON — falls back to the deterministic topic-interest extraction, so memory
 * keeps building exactly as before Stage 2.
 */
export class MemoryExtractor {
  constructor(
    private readonly llm: LlmClient,
    private readonly logger: Logger,
  ) {}

  async extract(
    question: string,
    answerText: string,
    matchedEntry: KnowledgeEntry,
  ): Promise<MemoryCandidate[]> {
    const fallback: MemoryCandidate[] = [
      { text: `Curious about ${matchedEntry.title}`, kind: "interest" },
    ];

    if (!this.llm.isEnabled()) {
      return fallback;
    }

    const raw = await this.llm.generate({
      system: EXTRACTION_SYSTEM_PROMPT,
      prompt: `USER asked: ${question}\nAMIA answered: ${answerText}\nMatched lore topic: ${matchedEntry.title}`,
      options: { temperature: 0.2, maxTokens: 150 },
    });

    if (!raw) {
      return fallback;
    }

    const parsed = this.parseCandidates(raw);
    if (parsed === null) {
      this.logger.warn("Memory extraction returned unparseable output; using fallback.");
      return fallback;
    }

    // An intentionally empty array means "nothing worth remembering" — respect it.
    return parsed;
  }

  private parseCandidates(raw: string): MemoryCandidate[] | null {
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start === -1 || end === -1 || end <= start) {
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }

    if (!Array.isArray(parsed)) {
      return null;
    }

    const candidates: MemoryCandidate[] = [];
    for (const item of parsed) {
      if (candidates.length >= MAX_CANDIDATES) {
        break;
      }
      if (typeof item !== "object" || item === null) {
        continue;
      }
      const text = String((item as { text?: unknown }).text ?? "").trim();
      const kind = String((item as { kind?: unknown }).kind ?? "");
      if (text.length === 0 || text.length > MAX_TEXT_LENGTH) {
        continue;
      }
      if (!VALID_KINDS.has(kind)) {
        continue;
      }
      if (PII_PATTERN.test(text)) {
        continue;
      }
      candidates.push({ text, kind: kind as MemoryKind });
    }

    return candidates;
  }
}
