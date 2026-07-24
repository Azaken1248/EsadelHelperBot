import type { IMemory, MemoryKind } from "../../models/memory.model";

export interface UpsertMemoryInput {
  discordUserId: string;
  text: string;
  kind: MemoryKind;
}

export interface MemoryRepository {
  /** Create the memory or, if it already exists, reinforce it (strength++). */
  upsertReinforce(input: UpsertMemoryInput): Promise<IMemory>;
  findByUser(discordUserId: string): Promise<IMemory[]>;
  /** Bump refCount + lastReferencedAt for the given ids (a recall reinforces). */
  touch(ids: string[]): Promise<void>;
  deleteByUser(discordUserId: string): Promise<number>;
}
