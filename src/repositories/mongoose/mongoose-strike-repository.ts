import { Types } from "mongoose";

import { StrikeModel, type IStrike, type StrikeAppealStatus } from "../../models/strike.model";
import type { CreateStrikeInput, StrikeRepository } from "../interfaces/strike-repository";

export class MongooseStrikeRepository implements StrikeRepository {
  async create(input: CreateStrikeInput): Promise<IStrike> {
    return StrikeModel.create({
      discordUserId: input.discordUserId,
      issuedBy: input.issuedBy,
      reason: input.reason,
      detail: input.detail ?? null,
    });
  }

  async findAll(): Promise<IStrike[]> {
    return StrikeModel.find().sort({ issuedAt: -1 }).exec();
  }

  async findByDiscordUserId(discordUserId: string): Promise<IStrike[]> {
    return StrikeModel.find({ discordUserId }).sort({ issuedAt: -1 }).exec();
  }

  async findById(id: string): Promise<IStrike | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    return StrikeModel.findById(id).exec();
  }

  async updateAppealStatus(
    id: string,
    status: StrikeAppealStatus,
    appealReason?: string | null,
    resolvedBy?: string | null,
  ): Promise<IStrike | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    const updatePayload: Record<string, unknown> = { appealStatus: status };

    if (appealReason !== undefined) {
      updatePayload.appealReason = appealReason;
    }

    if (resolvedBy !== undefined) {
      updatePayload.appealResolvedBy = resolvedBy;
    }

    return StrikeModel.findByIdAndUpdate(id, { $set: updatePayload }, { new: true }).exec();
  }

  async deleteById(id: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(id)) {
      return false;
    }

    const result = await StrikeModel.deleteOne({ _id: id }).exec();
    return result.deletedCount > 0;
  }
}
