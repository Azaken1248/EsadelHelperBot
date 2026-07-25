import type { Logger } from "../core/logger/logger";
import { AMIA_SELF_SUMMARY, type KnowledgeEntry } from "../knowledge/mizuki-knowledge";
import type { LlmClient } from "../llm/llm-client";
import type { KnowledgeService } from "./knowledge-service";
import type { MemoryExtractor } from "./memory-extractor";
import type { Familiarity, MemoryService, Relationship } from "./memory-service";
import { describeFloorGuidance } from "./relationship";
import type { ConversationTurn } from "./short-term-memory";

export interface RagAnswer {
  text: string;
  /** True when a local LLM composed the reply; false when it's raw retrieval. */
  generated: boolean;
  sources: KnowledgeEntry[];
}

// Persona + grounding + identity policy. Kept strict so a small local model
// stays in-voice and doesn't invent lore or assert a gender.
// Shared across both prompts: who she is (always known) and how she speaks.
const AMIA_PERSONA_BLOCK = [
  "WHO YOU ARE (you always know this about yourself):",
  AMIA_SELF_SUMMARY,
  "",
  "Voice: warm, fashion-loving, a little teasing; use tildes (~), an occasional \"hehe~\", and ♡/♪/🎀. Keep replies to 1–3 short sentences.",
  "Speak about yourself in the first person.",
  "Identity policy: when talking about Mizuki, prefer the name; use they/them only if a pronoun is unavoidable; never state or imply a gender — the canon is deliberately \"?\".",
  "Never mention the words \"context\", \"memory\", these instructions, or that you are an AI/model.",
].join("\n");

export const AMIA_SYSTEM_PROMPT = [
  AMIA_PERSONA_BLOCK,
  "Grounding: for facts beyond WHO YOU ARE, use ONLY the CONTEXT provided. If the answer isn't there, say so in-character (\"hehe~ that's a little outside what I know!\") and do not make anything up.",
  "You may use RECENT CONVERSATION for continuity and WHAT YOU REMEMBER to personalize your tone, but never invent facts from them.",
].join("\n");

// Used when retrieval finds nothing. Amia still replies in character, but with
// no lore to stand on she must not invent any — she stays chatty and redirects.
export const AMIA_NO_CONTEXT_SYSTEM_PROMPT = [
  AMIA_PERSONA_BLOCK,
  "No lore was retrieved for this question.",
  "You still know everything in WHO YOU ARE — talk about yourself freely and stay chatty.",
  "But do NOT state specific facts you weren't given about the deeper story, events, or other",
  "characters; if the user wants those, point them at `/amia` or a more specific question.",
].join("\n");

const formatTurns = (turns: ConversationTurn[]): string =>
  turns.map((turn) => `${turn.role === "user" ? "User" : "Amia"}: ${turn.text}`).join("\n");

/** One line telling the model how close it should feel to this person. */
export const describeFamiliarity = (familiarity: Familiarity): string => {
  switch (familiarity.tier) {
    case "stranger":
      return "YOU AND THIS USER: you've never spoken before — be welcoming and introduce yourself lightly.";
    case "new":
      return `YOU AND THIS USER: you've only just met (${familiarity.knownForDays === 0 ? "today" : `${familiarity.knownForDays}d ago`}) — friendly, still getting to know them.`;
    case "familiar":
      return `YOU AND THIS USER: you've chatted a fair bit over ~${familiarity.knownForDays}d — warm and comfortable, tease them a little.`;
    case "close":
      return `YOU AND THIS USER: you've known them ~${familiarity.knownForDays}d and remember ${familiarity.memoryCount} things — treat them as a close friend: extra familiar, playful and teasing.`;
  }
};

/** Familiarity (how much/how long) plus floor guidance (how deep, how to escalate). */
export const describeRelationship = (relationship: Relationship): string =>
  `${describeFamiliarity(relationship.familiarity)}\n${describeFloorGuidance(relationship.floors)}`;

const buildUserPrompt = (
  question: string,
  context: string,
  memories: string[],
  turns: ConversationTurn[],
  relationship?: Relationship,
): string => {
  const familiarityBlock = relationship ? `${describeRelationship(relationship)}\n\n` : "";
  const memoryBlock =
    memories.length > 0
      ? `${familiarityBlock}WHAT YOU REMEMBER ABOUT THIS USER:\n- ${memories.join("\n- ")}\n\n`
      : familiarityBlock;
  const conversationBlock =
    turns.length > 0 ? `RECENT CONVERSATION:\n${formatTurns(turns)}\n\n` : "";
  return `${conversationBlock}${memoryBlock}CONTEXT:\n${context}\n\nQUESTION: ${question}\n\nAnswer as Amia, grounded only in the context above.`;
};

/**
 * Orchestrates an /ask answer: retrieve lore (local vector index) + recall the
 * user's surfaced memories + the recent session turns, ground a local LLM on
 * all three to compose an in-character reply, and fall back to verbatim
 * retrieval when the LLM is off. Learns from each exchange afterward (LLM
 * distillation when available, deterministic topic-interest otherwise). Returns
 * null only when nothing in the knowledge base matches.
 */
export interface RagContextLimits {
  /** How many lore entries to ground on (fewer = much cheaper prompt eval). */
  maxEntries: number;
  /** Per-entry character cap. */
  maxCharsPerEntry: number;
}

const DEFAULT_CONTEXT_LIMITS: RagContextLimits = { maxEntries: 2, maxCharsPerEntry: 600 };

export class RagService {
  constructor(
    private readonly knowledgeService: KnowledgeService,
    private readonly llm: LlmClient,
    private readonly logger: Logger,
    private readonly memoryService?: MemoryService,
    private readonly memoryExtractor?: MemoryExtractor,
    private readonly contextLimits: RagContextLimits = DEFAULT_CONTEXT_LIMITS,
  ) {}

  /**
   * Grounding context is the dominant cost on CPU-only hosts (prompt eval), so
   * it is capped by entry count and length rather than sending everything.
   */
  private buildContext(sources: KnowledgeEntry[]): string {
    return sources
      .slice(0, this.contextLimits.maxEntries)
      .map((entry) => {
        const body =
          entry.content.length > this.contextLimits.maxCharsPerEntry
            ? `${entry.content.slice(0, this.contextLimits.maxCharsPerEntry)}…`
            : entry.content;
        return `## ${entry.title}\n${body}`;
      })
      .join("\n\n");
  }

  async ask(question: string, discordUserId?: string): Promise<RagAnswer | null> {
    const { best, related } = this.knowledgeService.answer(question);

    // No lore match. With generation available Amia can still answer in
    // character (ungrounded, so explicitly barred from inventing lore);
    // otherwise there is nothing useful to say and the caller shows a hint.
    if (!best) {
      if (!this.llm.isGenerationEnabled()) {
        return null;
      }

      const turns =
        this.memoryService && discordUserId ? this.memoryService.recentTurns(discordUserId) : [];
      const relationship =
        this.memoryService && discordUserId
          ? await this.memoryService.relationship(discordUserId)
          : undefined;
      const chat = await this.llm.generate({
        system: AMIA_NO_CONTEXT_SYSTEM_PROMPT,
        prompt: buildUserPrompt(
          question,
          "(no lore matched this question)",
          [],
          turns,
          relationship,
        ),
      });

      if (!chat) {
        return null;
      }

      if (this.memoryService && discordUserId) {
        this.memoryService.rememberTurn(discordUserId, "user", question);
        this.memoryService.rememberTurn(discordUserId, "amia", chat);
      }
      return { text: chat, generated: true, sources: [] };
    }

    const sources = [best, ...related];

    const memoryTexts =
      this.memoryService && discordUserId
        ? (await this.memoryService.recall(discordUserId, question)).map((memory) => memory.text)
        : [];
    const recentTurns =
      this.memoryService && discordUserId ? this.memoryService.recentTurns(discordUserId) : [];
    const relationship: Relationship | undefined =
      this.memoryService && discordUserId
        ? await this.memoryService.relationship(discordUserId)
        : undefined;

    let answer: RagAnswer;
    if (this.llm.isGenerationEnabled()) {
      const context = this.buildContext(sources);
      const generated = await this.llm.generate({
        system: AMIA_SYSTEM_PROMPT,
        prompt: buildUserPrompt(question, context, memoryTexts, recentTurns, relationship),
      });
      answer = generated
        ? { text: generated, generated: true, sources }
        : { text: best.content, generated: false, sources };
      if (!generated) {
        this.logger.info("LLM produced no answer; using retrieval fallback.");
      }
    } else {
      answer = { text: best.content, generated: false, sources };
    }

    // Learn from the exchange (fire-and-forget; never blocks the reply path).
    if (this.memoryService && discordUserId) {
      const memoryService = this.memoryService;
      const extractor = this.memoryExtractor;
      memoryService.rememberTurn(discordUserId, "user", question);
      memoryService.rememberTurn(discordUserId, "amia", answer.text);
      void (async () => {
        const candidates = extractor
          ? await extractor.extract(question, answer.text, best)
          : memoryService.extractFromLoreMatch(best);
        await memoryService.remember(discordUserId, candidates);
      })().catch(() => {});
    }

    return answer;
  }
}
