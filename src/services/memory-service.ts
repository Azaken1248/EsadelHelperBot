import type { Logger } from "../core/logger/logger";
import type { KnowledgeEntry } from "../knowledge/mizuki-knowledge";
import type { IMemory, MemoryKind } from "../models/memory.model";
import type {
  MemoryRepository,
  UpsertMemoryInput,
} from "../repositories/interfaces/memory-repository";

export interface MemoryCandidate {
  text: string;
  kind: MemoryKind;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Recency decay (~14-day half-life) and a frequency term, per the activation model.
const DECAY_LAMBDA_PER_DAY = 0.05;
const FREQUENCY_WEIGHT = 1;
const DEFAULT_TOP_K = 5;

const tokenize = (text: string): Set<string> =>
  new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3),
  );

/**
 * Per-user long-term memory with activation-based recall (the "surfacing"
 * mechanism): memories referenced often/recently score higher and are pulled
 * into the working set; unused ones decay. Privacy: distilled facts only, never
 * raw messages, and fully user-clearable via forget().
 */
export class MemoryService {
  constructor(
    private readonly repository: MemoryRepository,
    private readonly logger: Logger,
  ) {}

  private activation(memory: IMemory, now: number): number {
    const ageDays = Math.max(0, (now - memory.lastReferencedAt.getTime()) / MS_PER_DAY);
    const recency = memory.strength * Math.exp(-DECAY_LAMBDA_PER_DAY * ageDays);
    const frequency = FREQUENCY_WEIGHT * Math.log(1 + memory.refCount);
    return recency + frequency;
  }

  private relevance(memory: IMemory, queryTokens: Set<string>): number {
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

  /** Persist/reinforce distilled memories learned from an interaction. */
  async remember(discordUserId: string, candidates: MemoryCandidate[]): Promise<void> {
    for (const candidate of candidates) {
      const text = candidate.text.trim();
      if (text.length === 0) {
        continue;
      }
      const input: UpsertMemoryInput = { discordUserId, text, kind: candidate.kind };
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
    const memories = await this.repository.findByUser(discordUserId);
    if (memories.length === 0) {
      return [];
    }

    const now = Date.now();
    const queryTokens = tokenize(query);
    const ranked = memories
      .map((memory) => ({
        memory,
        score: this.activation(memory, now) * (1 + this.relevance(memory, queryTokens)),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((entry) => entry.memory);

    await this.repository.touch(ranked.map((memory) => memory.id));
    return ranked;
  }

  /** All memories for a user, most-activated first (for /memory). */
  async list(discordUserId: string): Promise<IMemory[]> {
    const memories = await this.repository.findByUser(discordUserId);
    const now = Date.now();
    return memories.sort((a, b) => this.activation(b, now) - this.activation(a, now));
  }

  async forget(discordUserId: string): Promise<number> {
    return this.repository.deleteByUser(discordUserId);
  }

  /** Deterministic extraction: what a lore question reveals about the user. */
  extractFromLoreMatch(entry: KnowledgeEntry): MemoryCandidate[] {
    return [{ text: `Curious about ${entry.title}`, kind: "interest" }];
  }
}
