import type { Logger } from "../core/logger/logger";
import type { AssignmentService } from "./assignment-service";
import type { UserService } from "./user-service";

export interface BulkAssignTarget {
  discordUserId: string;
  username: string;
}

export interface BulkAssignInput {
  targets: BulkAssignTarget[];
  roleId: string;
  taskName: string;
  description: string;
  deadline: Date;
  isTimeLimited: boolean;
}

export interface BulkAssignEntryResult {
  discordUserId: string;
  success: boolean;
  assignmentId?: string;
  error?: string;
}

export interface BulkAssignResult {
  taskName: string;
  total: number;
  succeeded: number;
  failed: number;
  results: BulkAssignEntryResult[];
}

/**
 * Bulk assignment engine (ARCHITECTURE.md §11.1).
 *
 * For each target member: ensure they are onboarded (auto-onboarding new or
 * reactivating deboarded members), then create an assignment. Per-member
 * failures are captured so a single bad target never aborts the batch.
 */
export class BulkAssignmentService {
  constructor(
    private readonly assignmentService: AssignmentService,
    private readonly userService: UserService,
    private readonly logger: Logger,
  ) {}

  async assignBulk(input: BulkAssignInput): Promise<BulkAssignResult> {
    const results: BulkAssignEntryResult[] = [];

    for (const target of input.targets) {
      try {
        await this.userService.onboard(target.discordUserId, target.username);

        const assignment = await this.assignmentService.assignTask({
          discordUserId: target.discordUserId,
          roleId: input.roleId,
          taskName: input.taskName,
          description: input.description,
          deadline: input.deadline,
          isTimeLimited: input.isTimeLimited,
        });

        results.push({
          discordUserId: target.discordUserId,
          success: true,
          assignmentId: assignment.id,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown assignment error.";
        results.push({
          discordUserId: target.discordUserId,
          success: false,
          error: message,
        });
      }
    }

    const succeeded = results.filter((entry) => entry.success).length;
    const failed = results.length - succeeded;

    this.logger.info("Bulk assignment completed.", {
      taskName: input.taskName,
      total: results.length,
      succeeded,
      failed,
    });

    return {
      taskName: input.taskName,
      total: results.length,
      succeeded,
      failed,
      results,
    };
  }
}
