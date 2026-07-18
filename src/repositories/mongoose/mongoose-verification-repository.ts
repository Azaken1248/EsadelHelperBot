import {
  VerificationModel,
  type IVerification,
  type VerificationStatus,
} from "../../models/verification.model";
import type {
  CreateVerificationInput,
  VerificationRepository,
} from "../interfaces/verification-repository";

export class MongooseVerificationRepository implements VerificationRepository {
  async create(input: CreateVerificationInput): Promise<IVerification> {
    return VerificationModel.create({
      discordUserId: input.discordUserId,
      guildId: input.guildId,
      token: input.token,
      status: "PENDING",
      verifiedAt: null,
    });
  }

  async findByToken(token: string): Promise<IVerification | null> {
    return VerificationModel.findOne({ token }).exec();
  }

  async findLatestForUser(discordUserId: string, guildId: string): Promise<IVerification | null> {
    return VerificationModel.findOne({ discordUserId, guildId })
      .sort({ createdAt: -1 })
      .exec();
  }

  async updateStatusByToken(
    token: string,
    status: VerificationStatus,
    verifiedAt?: Date | null,
  ): Promise<IVerification | null> {
    const updatePayload: Record<string, unknown> = { status };

    if (verifiedAt !== undefined) {
      updatePayload.verifiedAt = verifiedAt;
    }

    return VerificationModel.findOneAndUpdate(
      { token },
      { $set: updatePayload },
      { new: true },
    ).exec();
  }

  async markPendingTimedOut(discordUserId: string, guildId: string): Promise<number> {
    const result = await VerificationModel.updateMany(
      { discordUserId, guildId, status: "PENDING" },
      { $set: { status: "TIMED_OUT" } },
    ).exec();

    return result.modifiedCount;
  }
}
