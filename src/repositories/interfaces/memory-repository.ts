import type { IMemory, MemoryKind } from "../../models/memory.model";

export interface UpsertMemoryInput {
  discordUserId: string;
  text: string;
  kind: MemoryKind;
  /** Optional local-embedding vector (omitted when the embedder is unavailable). */
  embedding?: number[];
}

export interface MemoryRepository {
  /** Create the memory or, if it already exists, reinforce it (strength++). */
  upsertReinforce(input: UpsertMemoryInput): Promise<IMemory>;
  findByUser(discordUserId: string): Promise<IMemory[]>;
  /** Bump refCount + lastReferencedAt for the given ids (a recall reinforces). */
  touch(ids: string[]): Promise<void>;
  /** Hard-delete specific memories (the decay prune sweep). */
  deleteByIds(ids: string[]): Promise<number>;
  deleteByUser(discordUserId: string): Promise<number>;
}
