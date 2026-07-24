import type { Logger } from "../core/logger/logger";
import type { KnowledgeEntry } from "../knowledge/mizuki-knowledge";
import type { LlmClient } from "../llm/llm-client";
import type { IMemory, MemoryKind } from "../models/memory.model";
import type {
  MemoryRepository,
  UpsertMemoryInput,
} from "../repositories/interfaces/memory-repository";
import { ShortTermMemory, type ConversationTurn } from "./short-term-memory";

export interface MemoryCandidate {
  text: string;
  kind: MemoryKind;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Recency decay (~14-day half-life) and a frequency term, per the activation model.
const DECAY_LAMBDA_PER_DAY = 0.05;
const FREQUENCY_WEIGHT = 1;
const DEFAULT_TOP_K = 5;
// Never-recalled single-strength memories fall below this after ~2 idle months
// and are pruned; anything ever surfaced (refCount ≥ 1) stays above it forever.
const PRUNE_ACTIVATION_FLOOR = 0.05;

const tokenize = (text: string): Set<string> =>
  new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3),
  );

const cosine = (a: number[], b: number[]): number => {
  if (a.length === 0 || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i]! * b[i]!;
    magA += a[i]! * a[i]!;
    magB += b[i]! * b[i]!;
  }
  const denominator = Math.sqrt(magA) * Math.sqrt(magB);
  return denominator === 0 ? 0 : dot / denominator;
};

/**
 * The memory layer: per-user long-term memory with activation-based recall,
 * plus the ephemeral short-term session buffer.
 *
 * - Relevance is semantic (local embeddings, cosine) when the embedder is
 *   available, and falls back to keyword overlap per-memory when it isn't.
 * - Recall reinforces what it surfaces; a lazy prune sweep hard-deletes
 *   memories whose activation has decayed below the floor (real forgetting).
 * - Privacy: distilled facts only, never raw messages in long-term storage;
 *   forget() wipes both stores for the user.
 */
export class MemoryService {
  constructor(
    private readonly repository: MemoryRepository,
    private readonly logger: Logger,
    private readonly llm?: LlmClient,
    private readonly shortTerm: ShortTermMemory = new ShortTermMemory(),
  ) {}

  private activation(memory: IMemory, now: number): number {
    const ageDays = Math.max(0, (now - memory.lastReferencedAt.getTime()) / MS_PER_DAY);
    const recency = memory.strength * Math.exp(-DECAY_LAMBDA_PER_DAY * ageDays);
    const frequency = FREQUENCY_WEIGHT * Math.log(1 + memory.refCount);
    return recency + frequency;
  }

  private keywordRelevance(memory: IMemory, queryTokens: Set<string>): number {
    if (queryTokens.size === 0) {
      return 0;
    }
    const memoryTokens = tokenize(memory.text);
    let overlap = 0;
    for (const token of memoryTokens) {
      if (queryTokens.has(token)) {
        overlap += 1;
      }
    }
    return overlap;
  }

  /**
   * Semantic relevance when both sides have embeddings, keyword overlap
   * otherwise — so recall quality degrades gracefully per-memory.
   */
  private relevance(
    memory: IMemory,
    queryTokens: Set<string>,
    queryEmbedding: number[] | null,
  ): number {
    if (queryEmbedding && memory.embedding.length > 0) {
      const similarity = cosine(queryEmbedding, memory.embedding);
      return similarity > 0 ? similarity * 5 : 0;
    }
    return this.keywordRelevance(memory, queryTokens);
  }

  /** Hard-delete memories whose activation decayed below the floor. */
  private async pruneStale(memories: IMemory[], now: number): Promise<IMemory[]> {
    const stale = memories.filter((memory) => this.activation(memory, now) < PRUNE_ACTIVATION_FLOOR);
    if (stale.length > 0) {
      try {
        await this.repository.deleteByIds(stale.map((memory) => memory.id));
      } catch (error) {
        this.logger.warn("Memory prune sweep failed.", {
          message: error instanceof Error ? error.message : "Unknown error.",
        });
      }
    }
    const staleIds = new Set(stale.map((memory) => memory.id));
    return memories.filter((memory) => !staleIds.has(memory.id));
  }

  /** Persist/reinforce distilled memories learned from an interaction. */
  async remember(discordUserId: string, candidates: MemoryCandidate[]): Promise<void> {
    for (const candidate of candidates) {
      const text = candidate.text.trim();
      if (text.length === 0) {
        continue;
      }

      // Best-effort local embedding; null (LLM off/unreachable) simply means
      // this memory recalls via keyword overlap instead.
      const embedding = this.llm ? await this.llm.embed(text) : null;

      const input: UpsertMemoryInput = {
        discordUserId,
        text,
        kind: candidate.kind,
        ...(embedding ? { embedding } : {}),
      };
      try {
        await this.repository.upsertReinforce(input);
      } catch (error) {
        this.logger.warn("Failed to store a memory.", {
          discordUserId,
          message: error instanceof Error ? error.message : "Unknown error.",
        });
      }
    }
  }

  /**
   * Surface the most activated + relevant memories for a user, reinforcing the
   * ones that surface (so recall itself keeps them hot).
   */
  async recall(discordUserId: string, query: string, topK = DEFAULT_TOP_K): Promise<IMemory[]> {
    const all = await this.repository.findByUser(discordUserId);
    if (all.length === 0) {
      return [];
    }

    const now = Date.now();
    const memories = await this.pruneStale(all, now);
    if (memories.length === 0) {
      return [];
    }

    const queryTokens = tokenize(query);
    const queryEmbedding = this.llm ? await this.llm.embed(query) : null;

    const ranked = memories
      .map((memory) => ({
        memory,
        score:
          this.activation(memory, now) *
          (1 + this.relevance(memory, queryTokens, queryEmbedding)),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((entry) => entry.memory);

    await this.repository.touch(ranked.map((memory) => memory.id));
    return ranked;
  }

  /** All memories for a user, most-activated first (for /memory). */
  async list(discordUserId: string): Promise<IMemory[]> {
    const all = await this.repository.findByUser(discordUserId);
    const now = Date.now();
    const memories = await this.pruneStale(all, now);
    return memories.sort((a, b) => this.activation(b, now) - this.activation(a, now));
  }

  /** Wipe everything — long-term memories AND the live session buffer. */
  async forget(discordUserId: string): Promise<number> {
    this.shortTerm.clear(discordUserId);
    return this.repository.deleteByUser(discordUserId);
  }

  // ── Short-term (session) memory ────────────────────────────────────────────

  rememberTurn(discordUserId: string, role: ConversationTurn["role"], text: string): void {
    this.shortTerm.remember(discordUserId, role, text);
  }

  recentTurns(discordUserId: string): ConversationTurn[] {
    return this.shortTerm.recent(discordUserId);
  }

  /** Deterministic extraction: what a lore question reveals about the user. */
  extractFromLoreMatch(entry: KnowledgeEntry): MemoryCandidate[] {
    return [{ text: `Curious about ${entry.title}`, kind: "interest" }];
  }
}
