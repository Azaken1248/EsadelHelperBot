import type { IUser } from "../../models/user.model";

export interface CreateUserInput {
  discordId: string;
  username: string;
}

export interface UserRepository {
  findByDiscordId(discordId: string): Promise<IUser | null>;
  findAllActive(): Promise<IUser[]>;
  create(input: CreateUserInput): Promise<IUser>;
  reactivate(discordId: string, username: string): Promise<IUser | null>;
  markDeboarded(discordId: string, message?: string): Promise<IUser | null>;
  setHiatus(discordId: string, isOnHiatus: boolean, hiatusStartedAt: Date | null, hiatusReason: string | null): Promise<IUser | null>;
  incrementStrikes(discordId: string, amount: number): Promise<IUser | null>;
  setTimezone(discordId: string, timezone: string | null): Promise<IUser | null>;
  appendAssignment(discordId: string, assignmentId: string): Promise<void>;
  removeAssignment(discordId: string, assignmentId: string): Promise<void>;
}
