import type { Logger } from "../core/logger/logger";
import type { AssignmentRepository } from "../repositories/interfaces/assignment-repository";
import { TaskReminderScheduleService } from "./task-reminder-schedule-service";

export class TaskReminderBootstrapService {
  constructor(
    private readonly assignmentRepository: AssignmentRepository,
    private readonly taskReminderScheduleService: TaskReminderScheduleService,
    private readonly logger: Logger,
  ) {}

  async runStartupSync(): Promise<void> {
    const pendingAssignments = await this.assignmentRepository.findAllPending();
    const summary = await this.taskReminderScheduleService.scheduleForAssignments(
      pendingAssignments,
    );

    this.logger.info("Reminder bootstrap sync complete.", {
      pendingAssignments: summary.processed,
      remindersScheduled: summary.scheduled,
    });
  }
}
