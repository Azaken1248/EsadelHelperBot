import type { IAssignment } from "../models/assignment.model";
import type { Logger } from "../core/logger/logger";
import type { AssignmentRepository, HistoryFilter } from "../repositories/interfaces/assignment-repository";
import type { UserRepository } from "../repositories/interfaces/user-repository";
import { TaskReminderScheduleService } from "./task-reminder-schedule-service";

export interface AssignTaskInput {
  discordUserId: string;
  roleId: string;
  taskName: string;
  description: string;
  deadline: Date;
  isTimeLimited: boolean;
}

export interface ExtensionRequestInput {
  assignmentId: string;
  discordUserId: string;
  newDeadline: Date;
  bypassUserCheck?: boolean;
}

export interface ExtensionRequestResult {
  allowed: boolean;
  reason?: string;
  assignment?: IAssignment;
}

export interface RemoveTaskResult {
  success: boolean;
  reason?: string;
  assignment?: IAssignment;
}

export interface TransferTaskResult {
  success: boolean;
  reason?: string;
  assignment?: IAssignment;
  oldDiscordUserId?: string;
}

export interface SubmitTaskInput {
  assignmentId: string;
  discordUserId: string;
  bypassUserCheck?: boolean;
}

export type SubmitTaskStatus = "submitted" | "notFound" | "notOwner" | "notPending" | "onHiatus";

export interface SubmitTaskResult {
  status: SubmitTaskStatus;
  reason?: string;
  assignment?: IAssignment;
}

export class AssignmentService {
  constructor(
    private readonly assignmentRepository: AssignmentRepository,
    private readonly userRepository: UserRepository,
    private readonly taskReminderScheduleService: TaskReminderScheduleService,
    private readonly logger: Logger,
  ) {}

  async assignTask(input: AssignTaskInput): Promise<IAssignment> {
    const user = await this.userRepository.findByDiscordId(input.discordUserId);
    if (!user || user.isDeboarded) {
      throw new Error("Target user is not onboarded as an active crew member.");
    }

    if (user.isOnHiatus) {
      throw new Error("Target user is currently on hiatus and cannot receive new assignments.");
    }

    const assignment = await this.assignmentRepository.create({
      userId: user.id,
      discordUserId: input.discordUserId,
      roleId: input.roleId,
      taskName: input.taskName,
      description: input.description,
      deadline: input.deadline,
      isTimeLimited: input.isTimeLimited,
    });

    await this.userRepository.appendAssignment(input.discordUserId, assignment.id);

    try {
      await this.taskReminderScheduleService.scheduleForAssignment(assignment);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown reminder scheduling error.";
      this.logger.warn("Assignment created but reminder scheduling failed.", {
        assignmentId: assignment.id,
        message,
      });
    }

    this.logger.info("Assignment created.", {
      assignmentId: assignment.id,
      discordUserId: input.discordUserId,
      roleId: input.roleId,
    });

    return assignment;
  }

  async requestExtension(input: ExtensionRequestInput): Promise<ExtensionRequestResult> {
    const assignment = await this.assignmentRepository.findById(input.assignmentId);
    if (!assignment) {
      return { allowed: false, reason: "Assignment not found." };
    }

    if (!input.bypassUserCheck && assignment.discordUserId !== input.discordUserId) {
      return { allowed: false, reason: "You can only request extensions for your own assignments." };
    }

    if (assignment.isTimeLimited) {
      return { allowed: false, reason: "This assignment is marked as time-limited and cannot be auto-extended. Ask an owner for manual override." };
    }

    const user = await this.userRepository.findByDiscordId(assignment.discordUserId);
    if (user?.isOnHiatus) {
      return { allowed: false, reason: "You are currently on hiatus. End your hiatus with `/endhiatus` before requesting extensions." };
    }

    if (input.newDeadline <= assignment.deadline) {
      return { allowed: false, reason: "The new deadline must be later than the current deadline." };
    }

    const updatedAssignment = await this.assignmentRepository.extendDeadline(
      assignment.id,
      input.newDeadline,
    );

    if (!updatedAssignment) {
      return { allowed: false, reason: "Unable to apply extension right now." };
    }

    try {
      await this.taskReminderScheduleService.rescheduleForAssignment(updatedAssignment);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown reminder rescheduling error.";
      this.logger.warn("Assignment deadline extended but reminder rescheduling failed.", {
        assignmentId: updatedAssignment.id,
        message,
      });
    }

    this.logger.info("Assignment deadline extended.", {
      assignmentId: updatedAssignment.id,
      discordUserId: updatedAssignment.discordUserId,
      extensionsGranted: updatedAssignment.extensionsGranted,
    });

    return { allowed: true, assignment: updatedAssignment };
  }

  async removeTask(assignmentId: string): Promise<RemoveTaskResult> {
    const assignment = await this.assignmentRepository.findById(assignmentId);
    if (!assignment) {
      return { success: false, reason: "Assignment not found." };
    }

    await this.userRepository.removeAssignment(assignment.discordUserId, assignment.id);
    await this.assignmentRepository.deleteById(assignment.id);

    try {
      await this.taskReminderScheduleService.cancelRemindersForAssignment(assignment.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown reminder cancellation error.";
      this.logger.warn("Assignment removed but reminder cancellation failed.", {
        assignmentId: assignment.id,
        message,
      });
    }

    this.logger.info("Assignment removed.", {
      assignmentId: assignment.id,
      discordUserId: assignment.discordUserId,
    });

    return { success: true, assignment };
  }

  async transferTask(assignmentId: string, newDiscordUserId: string): Promise<TransferTaskResult> {
    const assignment = await this.assignmentRepository.findById(assignmentId);
    if (!assignment) {
      return { success: false, reason: "Assignment not found." };
    }

    if (assignment.discordUserId === newDiscordUserId) {
      return { success: false, reason: "Task is already assigned to this member." };
    }

    const newUser = await this.userRepository.findByDiscordId(newDiscordUserId);
    if (!newUser || newUser.isDeboarded) {
      return { success: false, reason: "Target member is not active or onboarded." };
    }

    if (newUser.isOnHiatus) {
      return { success: false, reason: "Target member is currently on hiatus and cannot receive transfers." };
    }

    await this.userRepository.removeAssignment(assignment.discordUserId, assignment.id);
    await this.userRepository.appendAssignment(newDiscordUserId, assignment.id);

    const updatedAssignment = await this.assignmentRepository.transfer(assignment.id, newUser.id, newDiscordUserId);
    if (!updatedAssignment) {
      return { success: false, reason: "Failed to transfer assignment." };
    }

    try {
      await this.taskReminderScheduleService.rescheduleForAssignment(updatedAssignment);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown reminder rescheduling error.";
      this.logger.warn("Assignment transferred but reminder rescheduling failed.", {
        assignmentId: updatedAssignment.id,
        message,
      });
    }

    this.logger.info("Assignment transferred.", {
      assignmentId: updatedAssignment.id,
      oldUserId: assignment.discordUserId,
      newUserId: newDiscordUserId,
    });

    return { success: true, assignment: updatedAssignment, oldDiscordUserId: assignment.discordUserId };
  }

  async getPendingTasks(discordUserId?: string): Promise<IAssignment[]> {
    if (discordUserId) {
      return this.assignmentRepository.findPendingByDiscordUserId(discordUserId);
    }

    return this.assignmentRepository.findAllPending();
  }

  async submitTask(input: SubmitTaskInput): Promise<SubmitTaskResult> {
    const assignment = await this.assignmentRepository.findById(input.assignmentId);
    if (!assignment) {
      return { status: "notFound", reason: "Assignment not found." };
    }

    if (!input.bypassUserCheck && assignment.discordUserId !== input.discordUserId) {
      return { status: "notOwner", reason: "You can only submit your own assignments." };
    }

    if (assignment.status !== "PENDING") {
      return {
        status: "notPending",
        reason: `This assignment is currently marked as \`${assignment.status}\` and cannot be submitted for review.`,
      };
    }

    const user = await this.userRepository.findByDiscordId(assignment.discordUserId);
    if (user?.isOnHiatus) {
      return {
        status: "onHiatus",
        reason: "You are currently on hiatus. End your hiatus with `/endhiatus` before submitting tasks.",
      };
    }

    this.logger.info("Task submitted for review.", {
      assignmentId: assignment.id,
      discordUserId: assignment.discordUserId,
    });

    return { status: "submitted", assignment };
  }

  async approveTask(assignmentId: string): Promise<IAssignment | null> {
    const updated = await this.assignmentRepository.updateStatus(assignmentId, "COMPLETED");
    if (updated) {
      this.logger.info("Task submission approved.", { assignmentId });

      try {
        await this.taskReminderScheduleService.cancelRemindersForAssignment(assignmentId);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown reminder cancellation error.";
        this.logger.warn("Task approved but reminder cancellation failed.", {
          assignmentId,
          message,
        });
      }
    }

    return updated;
  }

  async getHistory(discordUserId: string, filter?: HistoryFilter): Promise<IAssignment[]> {
    return this.assignmentRepository.findByDiscordUserId(discordUserId, filter);
  }
}
