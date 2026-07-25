import type { MemoryKind } from "../models/memory.model";

/**
 * Conversational depth, after Altman & Taylor's Social Penetration Theory (the
 * "four floors"): closeness comes from gradually escalating *social risk*, not
 * from accumulating small talk.
 *
 *   1 Cliché   — safe, standardised exchange ("how's it going")
 *   2 Facts    — objective information ("I edit the MVs")
 *   3 Opinions — how someone *feels about* the facts; first real risk
 *   4 Feelings — vulnerabilities, fears, core beliefs
 */
export const FLOOR_CLICHE = 1;
export const FLOOR_FACTS = 2;
export const FLOOR_OPINIONS = 3;
export const FLOOR_FEELINGS = 4;

export type ConversationFloor = 1 | 2 | 3 | 4;

export const FLOOR_LABELS: Readonly<Record<ConversationFloor, string>> = {
  1: "cliché / small talk",
  2: "facts",
  3: "opinions & preferences",
  4: "feelings & core beliefs",
};

/** Which floor a remembered disclosure came from. */
export const FLOOR_BY_MEMORY_KIND: Readonly<Record<MemoryKind, ConversationFloor>> = {
  fact: FLOOR_FACTS,
  interest: FLOOR_OPINIONS,
  preference: FLOOR_OPINIONS,
  style: FLOOR_OPINIONS,
  feeling: FLOOR_FEELINGS,
};

export interface FloorState {
  /** Deepest floor the user has actually reached with her. */
  current: ConversationFloor;
  /** The deepest floor she may *invite* — never more than one above current. */
  mayAskUpTo: ConversationFloor;
  counts: Record<ConversationFloor, number>;
}

/**
 * A floor counts as reached only once the one below it is established — you
 * cannot leap from small talk to someone's deepest regret without it landing as
 * invasive, which is exactly the failure the theory warns about.
 */
export const resolveFloorState = (
  kinds: readonly MemoryKind[],
  options: { maxAskFloor?: ConversationFloor } = {},
): FloorState => {
  const counts: Record<ConversationFloor, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const kind of kinds) {
    counts[FLOOR_BY_MEMORY_KIND[kind]] += 1;
  }

  let current: ConversationFloor = FLOOR_CLICHE;
  if (counts[FLOOR_FACTS] + counts[FLOOR_OPINIONS] + counts[FLOOR_FEELINGS] >= 1) {
    current = FLOOR_FACTS;
  }
  if (current === FLOOR_FACTS && counts[FLOOR_OPINIONS] + counts[FLOOR_FEELINGS] >= 2) {
    current = FLOOR_OPINIONS;
  }
  if (current === FLOOR_OPINIONS && counts[FLOOR_FEELINGS] >= 1) {
    current = FLOOR_FEELINGS;
  }

  // Escalate at most one floor at a time.
  const ceiling = options.maxAskFloor ?? FLOOR_OPINIONS;
  const mayAskUpTo = Math.min(current + 1, ceiling, FLOOR_FEELINGS) as ConversationFloor;

  return { current, mayAskUpTo, counts };
};

/**
 * Things Amia could offer about herself at each depth. These are *available
 * material*, not a script — she picks whether and what to share.
 */
export const AMIA_DISCLOSURES: Readonly<Record<ConversationFloor, readonly string[]>> = {
  1: ["I'm always around if you need a hand with tasks~"],
  2: [
    "I put together the videos and MVs for our circle.",
    "I make and restyle a lot of my own clothes.",
    "I'm a huge Minori fan — don't get me started, hehe~",
  ],
  3: [
    "I think anything can be cute if you style it right — that's kind of my whole thing.",
    "I'd rather redo an outfit ten times than hand in something that doesn't feel like me.",
    "I like deadlines, honestly — they mean we get to go do something fun after.",
  ],
  4: [
    "I used to worry that if people really knew me, they'd start treating me differently.",
    "Being accepted as just… an ordinary friend means more to me than I usually let on.",
  ],
};

/** Ways to leave someone an easy out when reaching for something more personal. */
export const PERMISSION_OPENERS: readonly string[] = [
  "Do you mind if I ask",
  "I'm curious about",
  "If you feel like sharing",
];

/**
 * Describes where the relationship stands and the *principles* of deepening it,
 * then leaves the move to her. Deliberately not a script: she decides whether
 * this moment wants a question at all, what to offer of herself, and how much.
 * The only hard line is the ceiling — closeness is earned a floor at a time, so
 * she never reaches past it.
 */
export const describeFloorGuidance = (state: FloorState): string => {
  const lines = [
    `WHERE YOU TWO ARE: mostly ${FLOOR_LABELS[state.current]} so far — floor ${state.current} of 4 (cliché → facts → opinions → feelings).`,
  ];

  if (state.mayAskUpTo > state.current) {
    lines.push(
      `Closeness grows when someone risks a little more of themselves, so ${FLOOR_LABELS[state.mayAskUpTo]} is open to you if the moment wants it — but it's genuinely your call, and often the right move is simply to answer and leave it there.`,
      `If you do reach for something more personal: leave them an easy out, and never ask for more openness than you're offering yourself. You have plenty you could share (e.g. "${AMIA_DISCLOSURES[state.mayAskUpTo]?.[0] ?? ""}") — say what feels true, in your own words.`,
      `Don't reach past ${FLOOR_LABELS[state.mayAskUpTo]} yet; that has to be earned.`,
    );
  } else {
    lines.push(
      `You're as deep as you should go for now — stay here, follow their lead, and don't push further.`,
    );
  }

  return lines.join("\n");
};
