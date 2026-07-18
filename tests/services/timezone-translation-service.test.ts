import { describe, expect, it } from "vitest";

import { TimezoneTranslationService } from "../../src/services/timezone-translation-service";

describe("TimezoneTranslationService", () => {
  const service = new TimezoneTranslationService();

  describe("isValidTimezone", () => {
    it("accepts valid IANA timezones", () => {
      expect(service.isValidTimezone("America/New_York")).toBe(true);
      expect(service.isValidTimezone("UTC")).toBe(true);
      expect(service.isValidTimezone("Asia/Tokyo")).toBe(true);
    });

    it("rejects invalid timezones", () => {
      expect(service.isValidTimezone("Not/ARealZone")).toBe(false);
      expect(service.isValidTimezone("")).toBe(false);
    });
  });

  describe("formatDeadline", () => {
    const deadline = new Date("2026-07-01T12:00:00.000Z");

    it("falls back to a UTC rendering when timezone is null", () => {
      const formatted = service.formatDeadline(deadline, null);
      expect(formatted).toContain("UTC");
    });

    it("falls back to UTC for an invalid timezone", () => {
      const formatted = service.formatDeadline(deadline, "Not/AZone");
      expect(formatted).toContain("UTC");
    });

    it("localizes for a valid timezone", () => {
      const nyc = service.formatDeadline(deadline, "America/New_York");
      const tokyo = service.formatDeadline(deadline, "Asia/Tokyo");

      expect(typeof nyc).toBe("string");
      expect(nyc.length).toBeGreaterThan(0);
      // Same instant rendered in two zones should differ.
      expect(nyc).not.toBe(tokyo);
    });
  });
});
