import type { ITaskReminder } from "../../models/task-reminder.model";

export interface CreateTaskReminderInput {
  assignmentId: string;
  discordUserId: string;
  taskName: string;
  deadline: Date;
  scheduledFor: Date;
  offsetMinutes: number;
  maxAttempts: number;
}

export interface TaskReminderRepository {
  createMany(reminders: CreateTaskReminderInput[]): Promise<void>;
  claimDueReminders(input: {
    now: Date;
    workerId: string;
    batchSize: number;
    lockDurationMs: number;
  }): Promise<ITaskReminder[]>;
  markSent(reminderId: string, sentAt: Date): Promise<void>;
  markFailed(reminderId: string, errorMessage: string): Promise<void>;
  cancelPendingForAssignment(assignmentId: string): Promise<void>;
}
