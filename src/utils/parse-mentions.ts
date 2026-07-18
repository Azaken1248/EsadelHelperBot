/**
 * Extracts unique Discord user IDs from a raw string of mentions.
 *
 * Handles both mention syntax (`<@123>`, `<@!123>`) and bare snowflake IDs
 * (17–20 digits) so `/bulkassign members:` accepts either. Order is preserved
 * by first occurrence; duplicates are dropped.
 */
export const parseUserMentions = (input: string): string[] => {
  const ids = new Set<string>();

  for (const match of input.matchAll(/<@!?(\d+)>/g)) {
    if (match[1]) {
      ids.add(match[1]);
    }
  }

  // Match any remaining bare snowflake IDs that weren't inside a mention.
  const withoutMentions = input.replace(/<@!?\d+>/g, " ");
  for (const match of withoutMentions.matchAll(/\b(\d{17,20})\b/g)) {
    if (match[1]) {
      ids.add(match[1]);
    }
  }

  return [...ids];
};
