import { describe, expect, it } from "vitest";

import { KnowledgeService } from "../../src/services/knowledge-service";

describe("KnowledgeService", () => {
  const service = new KnowledgeService();

  describe("search / answer", () => {
    it("finds the alias entry when asked about the Amia handle", () => {
      const { best } = service.answer("where does the handle Amia come from?");
      expect(best?.id).toBe("alias");
    });

    it("finds Ena when asked about her", () => {
      const { best } = service.answer("who is Ena?");
      expect(best?.id).toBe("rel-ena");
    });

    it("finds the gender/identity entry", () => {
      const { best } = service.answer("what is Mizuki's gender?");
      expect(best?.category).toBe("identity");
    });

    it("matches multi-word keywords like 'empty sekai'", () => {
      const results = service.search("empty sekai");
      expect(results.some((entry) => entry.id === "empty-sekai")).toBe(true);
    });

    it("returns nothing for an unrelated query", () => {
      expect(service.search("quarterly tax filing spreadsheet")).toEqual([]);
    });

    it("returns related entries alongside the best match", () => {
      const { best, related } = service.answer("tell me about the voice actor and songs");
      expect(best).not.toBeNull();
      expect(related.length).toBeGreaterThanOrEqual(1);
      expect(related).not.toContainEqual(best);
    });
  });

  describe("lookups", () => {
    it("gets an entry by id", () => {
      expect(service.getById("va")?.title).toContain("Hinata");
    });

    it("groups entries by category with non-zero counts", () => {
      const categories = service.listCategories();
      expect(categories.length).toBeGreaterThan(0);
      expect(categories.every((summary) => summary.count > 0)).toBe(true);
    });

    it("returns topic suggestions capped at the limit", () => {
      expect(service.searchTopics("", 5).length).toBeLessThanOrEqual(5);
      expect(service.searchTopics("song").some((entry) => entry.id === "songs")).toBe(true);
    });
  });

  describe("random content", () => {
    it("returns a non-empty fact", () => {
      expect(service.randomFact().length).toBeGreaterThan(0);
    });

    it("returns a quote with text and attribution", () => {
      const quote = service.randomQuote();
      expect(quote.text.length).toBeGreaterThan(0);
      expect(quote.attribution.length).toBeGreaterThan(0);
    });
  });
});
