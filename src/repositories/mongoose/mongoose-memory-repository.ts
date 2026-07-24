import { Types } from "mongoose";

import { MemoryModel, type IMemory } from "../../models/memory.model";
import type {
  MemoryRepository,
  UpsertMemoryInput,
} from "../interfaces/memory-repository";

export class MongooseMemoryRepository implements MemoryRepository {
  async upsertReinforce(input: UpsertMemoryInput): Promise<IMemory> {
    const now = new Date();
    const memory = await MemoryModel.findOneAndUpdate(
      { discordUserId: input.discordUserId, text: input.text },
      {
        $set: { kind: input.kind, lastReferencedAt: now },
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

  async deleteByUser(discordUserId: string): Promise<number> {
    const result = await MemoryModel.deleteMany({ discordUserId }).exec();
    return result.deletedCount ?? 0;
  }
}
