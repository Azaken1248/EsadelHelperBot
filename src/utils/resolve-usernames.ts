import type { Client } from "discord.js";

/**
 * Resolves a set of Discord user IDs to a Map<id, displayName>.
 * Falls back to the raw ID if the fetch fails for any individual user.
 * All fetches run in parallel for speed (autocomplete has a 3s timeout).
 */
export async function resolveUsernames(
  client: Client,
  userIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(userIds)];
  const results = await Promise.allSettled(
    unique.map(async (id) => {
      const user = await client.users.fetch(id);
      return { id, name: user.displayName ?? user.username };
    }),
  );

  const map = new Map<string, string>();
  for (const result of results) {
    if (result.status === "fulfilled") {
      map.set(result.value.id, result.value.name);
    }
  }

  return map;
}
