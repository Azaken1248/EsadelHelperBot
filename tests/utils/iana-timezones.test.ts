import { describe, expect, it } from "vitest";

import { IANA_TIMEZONES, searchTimezones } from "../../src/utils/iana-timezones";

describe("iana-timezones", () => {
  it("exposes a non-empty list of zones", () => {
    expect(IANA_TIMEZONES.length).toBeGreaterThan(0);
  });

  it("finds a zone by case-insensitive substring", () => {
    const results = searchTimezones("london");
    expect(results).toContain("Europe/London");
  });

  it("caps results at the requested limit", () => {
    const results = searchTimezones("America", 5);
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it("returns a capped prefix of the list for an empty query", () => {
    const results = searchTimezones("");
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(25);
  });
});
