import { Types } from "mongoose";

import {
  AssignmentModel,
  type AssignmentStatus,
  type IAssignment,
} from "../../models/assignment.model";
import type {
  AssignmentRepository,
  CreateAssignmentInput,
  HistoryFilter,
} from "../interfaces/assignment-repository";

export class MongooseAssignmentRepository implements AssignmentRepository {
  async create(input: CreateAssignmentInput): Promise<IAssignment> {
    return AssignmentModel.create({
      userId: new Types.ObjectId(input.userId),
      discordUserId: input.discordUserId,
      roleId: input.roleId,
      taskName: input.taskName,
      description: input.description,
      deadline: input.deadline,
      isTimeLimited: input.isTimeLimited,
    });
  }

  async findById(id: string): Promise<IAssignment | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    return AssignmentModel.findById(id).exec();
  }

  async extendDeadline(id: string, newDeadline: Date): Promise<IAssignment | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    return AssignmentModel.findByIdAndUpdate(
      id,
      {
        $set: { deadline: newDeadline },
        $inc: { extensionsGranted: 1 },
      },
      { new: true },
    ).exec();
  }

  async updateStatus(id: string, status: AssignmentStatus): Promise<IAssignment | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    return AssignmentModel.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true },
    ).exec();
  }

  async findPendingByDiscordUserId(discordUserId: string): Promise<IAssignment[]> {
    return AssignmentModel.find({
      discordUserId,
      status: "PENDING",
    }).exec();
  }

  async findAllPending(): Promise<IAssignment[]> {
    return AssignmentModel.find({
      status: "PENDING",
    }).exec();
  }

  async findByDiscordUserId(discordUserId: string, filter?: HistoryFilter): Promise<IAssignment[]> {
    const query: Record<string, unknown> = { discordUserId };

    if (filter?.status) {
      query.status = filter.status;
    }

    if (filter?.roleId) {
      query.roleId = filter.roleId;
    }

    if (filter?.taskName) {
      query.taskName = { $regex: filter.taskName, $options: "i" };
    }

    return AssignmentModel.find(query)
      .sort({ deadline: -1 })
      .limit(25)
      .exec();
  }

  async countByDiscordUserId(discordUserId: string, status?: AssignmentStatus): Promise<number> {
    const query = status ? { discordUserId, status } : { discordUserId };
    return AssignmentModel.countDocuments(query).exec();
  }

  async deleteById(id: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(id)) {
      return false;
    }

    const result = await AssignmentModel.deleteOne({ _id: id }).exec();
    return result.deletedCount === 1;
  }

  async transfer(id: string, newUserId: string, newDiscordUserId: string): Promise<IAssignment | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    return AssignmentModel.findByIdAndUpdate(
      id,
      {
        $set: {
          userId: new Types.ObjectId(newUserId),
          discordUserId: newDiscordUserId,
        },
      },
      { new: true },
    ).exec();
  }

  async pushDeadlinesByDiscordUserId(discordUserId: string, offsetMs: number): Promise<number> {
    const result = await AssignmentModel.updateMany(
      { discordUserId, status: "PENDING" },
      [
        {
          $set: {
            deadline: {
              $toDate: { $add: [{ $toLong: "$deadline" }, offsetMs] },
            },
          },
        },
      ],
    ).exec();

    return result.modifiedCount;
  }
}
