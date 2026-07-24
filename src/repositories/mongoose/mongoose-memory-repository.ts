import { Types } from "mongoose";

import { MemoryModel, type IMemory } from "../../models/memory.model";
import type {
  MemoryRepository,
  UpsertMemoryInput,
} from "../interfaces/memory-repository";

export class MongooseMemoryRepository implements MemoryRepository {
  async upsertReinforce(input: UpsertMemoryInput): Promise<IMemory> {
    const now = new Date();
    const set: Record<string, unknown> = { kind: input.kind, lastReferencedAt: now };
    if (input.embedding && input.embedding.length > 0) {
      set.embedding = input.embedding;
    }

    const memory = await MemoryModel.findOneAndUpdate(
      { discordUserId: input.discordUserId, text: input.text },
      {
        $set: set,
        $inc: { strength: 1 },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).exec();
    return memory;
  }

  async findByUser(discordUserId: string): Promise<IMemory[]> {
    return MemoryModel.find({ discordUserId }).exec();
  }

  async touch(ids: string[]): Promise<void> {
    const objectIds = ids.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
    if (objectIds.length === 0) {
      return;
    }
    await MemoryModel.updateMany(
      { _id: { $in: objectIds } },
      { $set: { lastReferencedAt: new Date() }, $inc: { refCount: 1 } },
    ).exec();
  }

  async deleteByIds(ids: string[]): Promise<number> {
    const objectIds = ids.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
    if (objectIds.length === 0) {
      return 0;
    }
    const result = await MemoryModel.deleteMany({ _id: { $in: objectIds } }).exec();
    return result.deletedCount ?? 0;
  }

  async deleteByUser(discordUserId: string): Promise<number> {
    const result = await MemoryModel.deleteMany({ discordUserId }).exec();
    return result.deletedCount ?? 0;
  }
}
