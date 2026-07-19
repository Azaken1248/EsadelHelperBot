interface Reactable {
  react(emoji: string): Promise<unknown>;
}

const isReactable = (value: unknown): value is Reactable =>
  typeof value === "object" &&
  value !== null &&
  "react" in value &&
  typeof (value as { react: unknown }).react === "function";

/**
 * Adds Amia's signature reactions to a message, best-effort. Reaction failures
 * (missing permission, deleted message, an unreactable mock) are swallowed so a
 * cosmetic flourish never breaks the command flow.
 */
export const reactSafely = async (message: unknown, emojis: readonly string[]): Promise<void> => {
  if (!isReactable(message)) {
    return;
  }

  for (const emoji of emojis) {
    try {
      await message.react(emoji);
    } catch {
      // best-effort — stop trying once one fails (usually a permissions issue)
      return;
    }
  }
};
