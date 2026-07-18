import type { AppConfig } from "../config/env";
import type { Logger } from "../core/logger/logger";
import type { IAssignment } from "../models/assignment.model";
import type { CreateTaskReminderInput, TaskReminderRepository } from "../repositories/interfaces/task-reminder-repository";

export class TaskReminderScheduleService {
  constructor(
    private readonly config: AppConfig,
    private readonly taskReminderRepository: TaskReminderRepository,
    private readonly logger: Logger,
  ) {}

  async scheduleForAssignment(assignment: IAssignment): Promise<number> {
    if (!this.config.reminders.enabled || assignment.status !== "PENDING") {
      return 0;
    }

    const reminders = this.buildReminderInputs(assignment, new Date());
    await this.taskReminderRepository.createMany(reminders);

    if (reminders.length > 0) {
      this.logger.info("Task reminders scheduled.", {
        assignmentId: assignment.id,
        reminderCount: reminders.length,
      });
    }

    return reminders.length;
  }

  async rescheduleForAssignment(assignment: IAssignment): Promise<number> {
    await this.taskReminderRepository.cancelPendingForAssignment(assignment.id);
    return this.scheduleForAssignment(assignment);
  }

  async cancelRemindersForAssignment(assignmentId: string): Promise<void> {
    await this.taskReminderRepository.cancelPendingForAssignment(assignmentId);
    this.logger.info("Task reminders cancelled.", { assignmentId });
  }

  async scheduleForAssignments(assignments: IAssignment[]): Promise<{ processed: number; scheduled: number }> {
    let scheduledCount = 0;

    for (const assignment of assignments) {
      scheduledCount += await this.scheduleForAssignment(assignment);
    }

    return {
      processed: assignments.length,
      scheduled: scheduledCount,
    };
  }

  private buildReminderInputs(assignment: IAssignment, now: Date): CreateTaskReminderInput[] {
    const deadlineTimestamp = assignment.deadline.getTime();
    if (deadlineTimestamp <= now.getTime()) {
      return [];
    }

    return this.config.reminders.offsetMinutes
      .map((offsetMinutes) => {
        const scheduledFor = new Date(deadlineTimestamp - offsetMinutes * 60_000);
        return {
          assignmentId: assignment.id,
          discordUserId: assignment.discordUserId,
          taskName: assignment.taskName,
          deadline: assignment.deadline,
          scheduledFor,
          offsetMinutes,
          maxAttempts: this.config.reminders.maxAttempts,
        } satisfies CreateTaskReminderInput;
      })
      .filter((reminder) => reminder.scheduledFor.getTime() > now.getTime());
  }
}
