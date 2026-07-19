// A small in-memory vector index for semantic-ish retrieval over the knowledge
// base. Documents are embedded as L2-normalized TF-IDF vectors and ranked by
// cosine similarity; queries get light synonym expansion so paraphrases still
// hit. No external embedding provider or dependency is required.
//
// The interface (build once, search(query)) is deliberately provider-agnostic:
// swapping TF-IDF for neural embeddings + an external vector store later only
// changes the internals, not the callers (KnowledgeService).

export interface WeightedSegment {
  text: string;
  weight: number;
}

export interface RankedResult<T> {
  item: T;
  score: number;
}

interface IndexedDoc<T> {
  item: T;
  vector: Map<string, number>;
}

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "do", "does",
  "did", "of", "to", "in", "on", "at", "for", "and", "or", "but", "with", "as",
  "by", "from", "that", "this", "these", "those", "it", "its", "what", "who",
  "whom", "whose", "why", "how", "when", "where", "which", "you", "your", "me",
  "my", "i", "we", "us", "about", "tell", "can", "could", "would", "please",
  "there", "here", "so", "some", "any", "all",
]);

// Query-side synonym expansion (keys/values in stemmed form). Bridges the gap
// between how people phrase questions and the words in the lore.
const SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  gender: ["identity", "pronoun"],
  boy: ["gender", "identity"],
  girl: ["gender", "identity"],
  male: ["gender", "identity"],
  female: ["gender", "identity"],
  pronoun: ["gender", "identity"],
  trans: ["gender", "identity"],
  girlfriend: ["relationship", "ena"],
  boyfriend: ["relationship"],
  dating: ["relationship", "ship"],
  ship: ["relationship", "ena"],
  crush: ["relationship"],
  song: ["music"],
  music: ["song"],
  track: ["song", "music"],
  sing: ["song", "music"],
  voice: ["va", "seiyuu"],
  actor: ["va", "seiyuu"],
  seiyuu: ["va"],
  look: ["appearance"],
  hair: ["appearance"],
  outfit: ["fashion", "clothe"],
  clothe: ["fashion"],
  age: ["birthday", "vital"],
  born: ["birthday"],
  movie: ["film"],
  sister: ["yuuki", "family"],
  family: ["relationship"],
  friend: ["relationship"],
  bully: ["backstory"],
  bullied: ["backstory"],
  secret: ["identity", "arc"],
  personality: ["personality", "trait"],
};

// Crude stemmer: collapse simple plurals so "songs"/"song" and
// "relationships"/"relationship" share a term. Applied to docs and queries.
const stem = (token: string): string => {
  if (token.length > 4 && token.endsWith("s")) {
    return token.slice(0, -1);
  }
  return token;
};

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token))
    .map(stem);

const l2Normalize = (vector: Map<string, number>): void => {
  let sumSquares = 0;
  for (const weight of vector.values()) {
    sumSquares += weight * weight;
  }
  const magnitude = Math.sqrt(sumSquares);
  if (magnitude === 0) {
    return;
  }
  for (const [term, weight] of vector) {
    vector.set(term, weight / magnitude);
  }
};

export class TfIdfVectorIndex<T> {
  private readonly idf = new Map<string, number>();
  private readonly docs: IndexedDoc<T>[] = [];

  constructor(items: readonly T[], toSegments: (item: T) => WeightedSegment[]) {
    const termFrequencies: Map<string, number>[] = [];
    const documentFrequency = new Map<string, number>();

    for (const item of items) {
      const tf = new Map<string, number>();
      for (const segment of toSegments(item)) {
        for (const term of tokenize(segment.text)) {
          tf.set(term, (tf.get(term) ?? 0) + segment.weight);
        }
      }
      termFrequencies.push(tf);
      for (const term of tf.keys()) {
        documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
      }
    }

    const total = items.length;
    for (const [term, df] of documentFrequency) {
      // Smoothed IDF.
      this.idf.set(term, Math.log((total + 1) / (df + 1)) + 1);
    }

    items.forEach((item, docIndex) => {
      const vector = new Map<string, number>();
      const tf = termFrequencies[docIndex]!;
      for (const [term, freq] of tf) {
        vector.set(term, freq * (this.idf.get(term) ?? 0));
      }
      l2Normalize(vector);
      this.docs.push({ item, vector });
    });
  }

  private buildQueryVector(query: string): Map<string, number> {
    const tokens = tokenize(query);
    const expanded: string[] = [];
    for (const token of tokens) {
      expanded.push(token);
      for (const synonym of SYNONYMS[token] ?? []) {
        expanded.push(stem(synonym));
      }
    }

    const vector = new Map<string, number>();
    for (const term of expanded) {
      const idf = this.idf.get(term);
      if (idf === undefined) {
        continue; // out-of-vocabulary terms contribute nothing
      }
      vector.set(term, (vector.get(term) ?? 0) + idf);
    }
    l2Normalize(vector);
    return vector;
  }

  search(query: string, limit = 5, minScore = 0.02): RankedResult<T>[] {
    const queryVector = this.buildQueryVector(query);
    if (queryVector.size === 0) {
      return [];
    }

    const results: RankedResult<T>[] = [];
    for (const doc of this.docs) {
      // Cosine similarity — both vectors are L2-normalized, so it's a dot product.
      let score = 0;
      const [smaller, larger] =
        queryVector.size <= doc.vector.size ? [queryVector, doc.vector] : [doc.vector, queryVector];
      for (const [term, weight] of smaller) {
        const other = larger.get(term);
        if (other !== undefined) {
          score += weight * other;
        }
      }
      if (score >= minScore) {
        results.push({ item: doc.item, score });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}
