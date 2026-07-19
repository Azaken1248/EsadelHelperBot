import {
  AMIA_FUN_FACTS,
  AMIA_QUOTES,
  CATEGORY_LABELS,
  KNOWLEDGE_ENTRIES,
  type AmiaQuote,
  type KnowledgeCategory,
  type KnowledgeEntry,
} from "../knowledge/mizuki-knowledge";
import { TfIdfVectorIndex } from "../knowledge/vector-index";

export interface CategorySummary {
  category: KnowledgeCategory;
  label: string;
  count: number;
}

export interface AnswerResult {
  best: KnowledgeEntry | null;
  related: KnowledgeEntry[];
}

/**
 * Amia's knowledge base (the Mizuki lore). Pure and dependency-free. Retrieval
 * runs over an in-memory TF-IDF vector index (cosine similarity + synonym
 * expansion) built once from the static entries, powering the /ask, /amia,
 * /fact, and /quote commands.
 */
export class KnowledgeService {
  private readonly entries: readonly KnowledgeEntry[] = KNOWLEDGE_ENTRIES;

  private readonly index = new TfIdfVectorIndex<KnowledgeEntry>(this.entries, (entry) => [
    { text: entry.title, weight: 3 },
    { text: entry.keywords.join(" "), weight: 4 },
    { text: entry.summary, weight: 2 },
    { text: entry.content, weight: 1 },
  ]);

  /** Semantic-ish ranked search across the knowledge base. */
  search(query: string, limit = 5): KnowledgeEntry[] {
    return this.index.search(query, limit).map((result) => result.item);
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
