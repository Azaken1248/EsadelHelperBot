import {
  AMIA_FUN_FACTS,
  AMIA_QUOTES,
  CATEGORY_LABELS,
  KNOWLEDGE_ENTRIES,
  type AmiaQuote,
  type KnowledgeCategory,
  type KnowledgeEntry,
} from "../knowledge/mizuki-knowledge";

export interface CategorySummary {
  category: KnowledgeCategory;
  label: string;
  count: number;
}

export interface AnswerResult {
  best: KnowledgeEntry | null;
  related: KnowledgeEntry[];
}

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "do", "does", "did", "of", "to",
  "in", "on", "for", "and", "or", "what", "who", "whom", "whose", "why", "how",
  "when", "where", "which", "you", "your", "me", "my", "i", "about", "tell",
  "can", "please", "mizuki",
]);

const tokenize = (input: string): string[] =>
  input
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);

/**
 * Amia's knowledge base (the Mizuki lore). Pure and dependency-free — reads the
 * static entries in ../knowledge/mizuki-knowledge and scores relevance for the
 * /ask, /amia, /fact, and /quote commands.
 */
export class KnowledgeService {
  private readonly entries: readonly KnowledgeEntry[] = KNOWLEDGE_ENTRIES;

  private scoreEntry(entry: KnowledgeEntry, tokens: string[]): number {
    if (tokens.length === 0) {
      return 0;
    }

    const keywordSet = new Set(entry.keywords.map((keyword) => keyword.toLowerCase()));
    const titleTokens = new Set(tokenize(entry.title));
    const haystack = `${entry.title} ${entry.summary} ${entry.content}`.toLowerCase();

    let score = 0;
    for (const token of tokens) {
      if (keywordSet.has(token)) {
        score += 5;
      }
      // Multi-word keywords (e.g. "empty sekai") matched as substrings.
      for (const keyword of keywordSet) {
        if (keyword.includes(" ") && keyword.includes(token)) {
          score += 2;
          break;
        }
      }
      if (titleTokens.has(token)) {
        score += 3;
      }
      if (haystack.includes(token)) {
        score += 1;
      }
    }

    return score;
  }

  /** Ranked full-text-ish search across the knowledge base. */
  search(query: string, limit = 5): KnowledgeEntry[] {
    const tokens = tokenize(query).filter((token) => !STOP_WORDS.has(token));
    if (tokens.length === 0) {
      return [];
    }

    return this.entries
      .map((entry) => ({ entry, score: this.scoreEntry(entry, tokens) }))
      .filter((scored) => scored.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((scored) => scored.entry);
  }

  /** Answer a natural-language question with the best entry plus related ones. */
  answer(question: string): AnswerResult {
    const [best, ...related] = this.search(question, 4);
    return {
      best: best ?? null,
      related: related.slice(0, 3),
    };
  }

  getById(id: string): KnowledgeEntry | undefined {
    return this.entries.find((entry) => entry.id === id);
  }

  getByCategory(category: KnowledgeCategory): KnowledgeEntry[] {
    return this.entries.filter((entry) => entry.category === category);
  }

  listCategories(): CategorySummary[] {
    return (Object.keys(CATEGORY_LABELS) as KnowledgeCategory[])
      .map((category) => ({
        category,
        label: CATEGORY_LABELS[category],
        count: this.getByCategory(category).length,
      }))
      .filter((summary) => summary.count > 0);
  }

  /** Topic suggestions for autocomplete (title match, falls back to all). */
  searchTopics(query: string, limit = 25): KnowledgeEntry[] {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      return this.entries.slice(0, limit);
    }

    const ranked = this.search(trimmed, limit);
    if (ranked.length > 0) {
      return ranked;
    }

    const lower = trimmed.toLowerCase();
    return this.entries
      .filter((entry) => entry.title.toLowerCase().includes(lower))
      .slice(0, limit);
  }

  randomFact(): string {
    const index = Math.floor(Math.random() * AMIA_FUN_FACTS.length);
    return AMIA_FUN_FACTS[index] ?? AMIA_FUN_FACTS[0]!;
  }

  randomQuote(): AmiaQuote {
    const index = Math.floor(Math.random() * AMIA_QUOTES.length);
    return AMIA_QUOTES[index] ?? AMIA_QUOTES[0]!;
  }
}
