import type { AssignmentStatus, IAssignment } from "../../models/assignment.model";

export interface CreateAssignmentInput {
  userId: string;
  discordUserId: string;
  roleId: string;
  taskName: string;
  description: string;
  deadline: Date;
  isTimeLimited: boolean;
}

export interface HistoryFilter {
  status?: AssignmentStatus;
  roleId?: string;
  taskName?: string;
}

export interface AssignmentRepository {
  create(input: CreateAssignmentInput): Promise<IAssignment>;
  findById(id: string): Promise<IAssignment | null>;
  extendDeadline(id: string, newDeadline: Date): Promise<IAssignment | null>;
  updateStatus(id: string, status: AssignmentStatus): Promise<IAssignment | null>;
  findPendingByDiscordUserId(discordUserId: string): Promise<IAssignment[]>;
  findAllPending(): Promise<IAssignment[]>;
  findByDiscordUserId(discordUserId: string, filter?: HistoryFilter): Promise<IAssignment[]>;
  countByDiscordUserId(discordUserId: string, status?: AssignmentStatus): Promise<number>;
  deleteById(id: string): Promise<boolean>;
  transfer(id: string, newUserId: string, newDiscordUserId: string): Promise<IAssignment | null>;
  pushDeadlinesByDiscordUserId(discordUserId: string, offsetMs: number): Promise<number>;
}
