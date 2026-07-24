export interface ConversationTurn {
  role: "user" | "amia";
  text: string;
  at: number;
}

interface Session {
  turns: ConversationTurn[];
  updatedAt: number;
}

const DEFAULT_MAX_TURNS = 8;
const DEFAULT_TTL_MS = 30 * 60 * 1000; // a session fades after 30 minutes idle
const DEFAULT_MAX_USERS = 500;
const MAX_TURN_TEXT = 300;

/**
 * Ephemeral per-user working memory (the "context window"): the last few
 * conversation turns, held in-process only. Never persisted, expires after a
 * short idle TTL, bounded per user and globally, and cleared by /forgetme.
 */
export class ShortTermMemory {
  private readonly sessions = new Map<string, Session>();

  constructor(
    private readonly maxTurns = DEFAULT_MAX_TURNS,
    private readonly ttlMs = DEFAULT_TTL_MS,
    private readonly maxUsers = DEFAULT_MAX_USERS,
  ) {}

  remember(discordUserId: string, role: ConversationTurn["role"], text: string): void {
    const now = Date.now();
    const trimmed = text.trim().slice(0, MAX_TURN_TEXT);
    if (trimmed.length === 0) {
      return;
    }

    const session = this.liveSession(discordUserId, now) ?? { turns: [], updatedAt: now };
    session.turns.push({ role, text: trimmed, at: now });
    if (session.turns.length > this.maxTurns) {
      session.turns.splice(0, session.turns.length - this.maxTurns);
    }
    session.updatedAt = now;
    this.sessions.set(discordUserId, session);
    this.evictIfNeeded();
  }

  recent(discordUserId: string): ConversationTurn[] {
    const session = this.liveSession(discordUserId, Date.now());
    return session ? [...session.turns] : [];
  }

  clear(discordUserId: string): void {
    this.sessions.delete(discordUserId);
  }

  private liveSession(discordUserId: string, now: number): Session | null {
    const session = this.sessions.get(discordUserId);
    if (!session) {
      return null;
    }
    if (now - session.updatedAt > this.ttlMs) {
      this.sessions.delete(discordUserId);
      return null;
    }
    return session;
  }

  private evictIfNeeded(): void {
    if (this.sessions.size <= this.maxUsers) {
      return;
    }
    let oldestKey: string | null = null;
    let oldestAt = Infinity;
    for (const [key, session] of this.sessions) {
      if (session.updatedAt < oldestAt) {
        oldestAt = session.updatedAt;
        oldestKey = key;
      }
    }
    if (oldestKey !== null) {
      this.sessions.delete(oldestKey);
    }
  }
}
