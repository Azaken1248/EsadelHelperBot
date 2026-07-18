import { Types } from "mongoose";

import { UserModel, type IUser } from "../../models/user.model";
import type { CreateUserInput, UserRepository } from "../interfaces/user-repository";

export class MongooseUserRepository implements UserRepository {
  async findByDiscordId(discordId: string): Promise<IUser | null> {
    return UserModel.findOne({ discordId }).exec();
  }

  async findAllActive(): Promise<IUser[]> {
    return UserModel.find({ isDeboarded: false }).exec();
  }

  async create(input: CreateUserInput): Promise<IUser> {
    return UserModel.create({
      discordId: input.discordId,
      username: input.username,
    });
  }

  async reactivate(discordId: string, username: string): Promise<IUser | null> {
    return UserModel.findOneAndUpdate(
      { discordId },
      {
        $set: {
          username,
          isDeboarded: false,
          isOnHiatus: false,
          deboardedAt: null,
        },
      },
      { new: true },
    ).exec();
  }

  async markDeboarded(discordId: string, message?: string): Promise<IUser | null> {
    const setPayload: {
      isDeboarded: boolean;
      deboardedAt: Date;
      deboardedMessage?: string;
    } = {
      isDeboarded: true,
      deboardedAt: new Date(),
    };

    if (message) {
      setPayload.deboardedMessage = message;
    }

    return UserModel.findOneAndUpdate(
      { discordId },
      { $set: setPayload },
      { new: true },
    ).exec();
  }

  async setHiatus(discordId: string, isOnHiatus: boolean, hiatusStartedAt: Date | null, hiatusReason: string | null): Promise<IUser | null> {
    return UserModel.findOneAndUpdate(
      { discordId },
      { $set: { isOnHiatus, hiatusStartedAt, hiatusReason } },
      { new: true },
    ).exec();
  }

  async incrementStrikes(discordId: string, amount: number): Promise<IUser | null> {
    return UserModel.findOneAndUpdate(
      { discordId },
      { $inc: { strikes: amount } },
      { new: true },
    ).exec();
  }

  async setTimezone(discordId: string, timezone: string | null): Promise<IUser | null> {
    return UserModel.findOneAndUpdate(
      { discordId },
      { $set: { timezone } },
      { new: true },
    ).exec();
  }

  async appendAssignment(discordId: string, assignmentId: string): Promise<void> {
    if (!Types.ObjectId.isValid(assignmentId)) {
      throw new Error("Invalid assignment id.");
    }

    await UserModel.updateOne(
      { discordId },
      {
        $addToSet: {
          assignments: new Types.ObjectId(assignmentId),
        },
      },
    ).exec();
  }

  async removeAssignment(discordId: string, assignmentId: string): Promise<void> {
    if (!Types.ObjectId.isValid(assignmentId)) {
      throw new Error("Invalid assignment id.");
    }

    await UserModel.updateOne(
      { discordId },
      {
        $pull: {
          assignments: new Types.ObjectId(assignmentId),
        },
      },
    ).exec();
  }
}
