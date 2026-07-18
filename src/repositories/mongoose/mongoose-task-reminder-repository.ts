import { Types } from "mongoose";

import { TaskReminderModel, type ITaskReminder } from "../../models/task-reminder.model";
import type {
  CreateTaskReminderInput,
  TaskReminderRepository,
} from "../interfaces/task-reminder-repository";

const MAX_ERROR_LENGTH = 1024;

export class MongooseTaskReminderRepository implements TaskReminderRepository {
  async createMany(reminders: CreateTaskReminderInput[]): Promise<void> {
    if (reminders.length === 0) {
      return;
    }

    const validReminders = reminders.filter((reminder) =>
      Types.ObjectId.isValid(reminder.assignmentId),
    );

    await Promise.all(
      validReminders.map(async (reminder) => {
        const assignmentObjectId = new Types.ObjectId(reminder.assignmentId);

        await TaskReminderModel.updateOne(
          {
            assignmentId: assignmentObjectId,
            offsetMinutes: reminder.offsetMinutes,
          },
          {
            $setOnInsert: {
              assignmentId: assignmentObjectId,
              discordUserId: reminder.discordUserId,
              taskName: reminder.taskName,
              deadline: reminder.deadline,
              scheduledFor: reminder.scheduledFor,
              offsetMinutes: reminder.offsetMinutes,
              maxAttempts: reminder.maxAttempts,
              status: "PENDING",
              attemptCount: 0,
              lockedBy: null,
              lockExpiresAt: null,
              sentAt: null,
              lastError: null,
            },
          },
          {
            upsert: true,
          },
        ).exec();
      }),
    );
  }

  async claimDueReminders(input: {
    now: Date;
    workerId: string;
    batchSize: number;
    lockDurationMs: number;
  }): Promise<ITaskReminder[]> {
    const claimedReminders: ITaskReminder[] = [];

    for (let index = 0; index < input.batchSize; index += 1) {
      const lockExpiry = new Date(input.now.getTime() + input.lockDurationMs);

      const claimedReminder = await TaskReminderModel.findOneAndUpdate(
        {
          status: { $in: ["PENDING", "FAILED"] },
          scheduledFor: { $lte: input.now },
          $expr: { $lt: ["$attemptCount", "$maxAttempts"] },
          $or: [{ lockExpiresAt: null }, { lockExpiresAt: { $lte: input.now } }],
        },
        {
          $set: {
            status: "PROCESSING",
            lockedBy: input.workerId,
            lockExpiresAt: lockExpiry,
            lastError: null,
          },
          $inc: {
            attemptCount: 1,
          },
        },
        {
          new: true,
          sort: {
            scheduledFor: 1,
          },
        },
      ).exec();

      if (!claimedReminder) {
        break;
      }

      claimedReminders.push(claimedReminder);
    }

    return claimedReminders;
  }

  async markSent(reminderId: string, sentAt: Date): Promise<void> {
    if (!Types.ObjectId.isValid(reminderId)) {
      return;
    }

    await TaskReminderModel.updateOne(
      { _id: reminderId },
      {
        $set: {
          status: "SENT",
          sentAt,
          lockExpiresAt: null,
          lockedBy: null,
          lastError: null,
        },
      },
    ).exec();
  }

  async markFailed(reminderId: string, errorMessage: string): Promise<void> {
    if (!Types.ObjectId.isValid(reminderId)) {
      return;
    }

    await TaskReminderModel.updateOne(
      { _id: reminderId },
      {
        $set: {
          status: "FAILED",
          lockExpiresAt: null,
          lockedBy: null,
          lastError: errorMessage.slice(0, MAX_ERROR_LENGTH),
        },
      },
    ).exec();
  }

  async cancelPendingForAssignment(assignmentId: string): Promise<void> {
    if (!Types.ObjectId.isValid(assignmentId)) {
      return;
    }

    await TaskReminderModel.updateMany(
      {
        assignmentId: new Types.ObjectId(assignmentId),
        status: {
          $in: ["PENDING", "FAILED", "PROCESSING"],
        },
      },
      {
        $set: {
          status: "CANCELLED",
          lockExpiresAt: null,
          lockedBy: null,
        },
      },
    ).exec();
  }
}
