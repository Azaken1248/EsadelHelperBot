/**
 * Timezone translation (ARCHITECTURE.md §11.2).
 *
 * Converts a UTC deadline into a human-readable string localized to a member's
 * stored IANA timezone. Falls back to a UTC rendering when no (or an invalid)
 * timezone is supplied, so callers never have to special-case missing prefs.
 */
export class TimezoneTranslationService {
  isValidTimezone(timezone: string): boolean {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }

  formatDeadline(deadline: Date, timezone: string | null): string {
    if (timezone && this.isValidTimezone(timezone)) {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        dateStyle: "medium",
        timeStyle: "short",
        timeZoneName: "short",
      }).format(deadline);
    }

    return this.formatUtc(deadline);
  }

  private formatUtc(deadline: Date): string {
    return `${new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(deadline)} UTC`;
  }
}
