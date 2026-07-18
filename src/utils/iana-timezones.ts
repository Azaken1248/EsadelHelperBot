// Curated fallback list used when the runtime doesn't expose
// Intl.supportedValuesOf (older Node) — a spread of common IANA zones.
const FALLBACK_TIMEZONES: readonly string[] = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Moscow",
  "Africa/Cairo",
  "Africa/Lagos",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
];

const loadTimezones = (): readonly string[] => {
  const intlWithValues = Intl as unknown as {
    supportedValuesOf?: (key: "timeZone") => string[];
  };

  if (typeof intlWithValues.supportedValuesOf === "function") {
    try {
      const zones = intlWithValues.supportedValuesOf("timeZone");
      if (zones.length > 0) {
        return zones;
      }
    } catch {
      // fall through to the curated list
    }
  }

  return FALLBACK_TIMEZONES;
};

export const IANA_TIMEZONES: readonly string[] = loadTimezones();

/** Case-insensitive substring match, capped for Discord's 25-choice limit. */
export const searchTimezones = (query: string, limit = 25): string[] => {
  const normalized = query.trim().toLowerCase();
  const source = IANA_TIMEZONES;

  if (normalized.length === 0) {
    return source.slice(0, limit);
  }

  return source.filter((zone) => zone.toLowerCase().includes(normalized)).slice(0, limit);
};
