import type { IVerification, VerificationStatus } from "../../models/verification.model";

export interface CreateVerificationInput {
  discordUserId: string;
  guildId: string;
  token: string;
}

export interface VerificationRepository {
  create(input: CreateVerificationInput): Promise<IVerification>;
  findByToken(token: string): Promise<IVerification | null>;
  findLatestForUser(discordUserId: string, guildId: string): Promise<IVerification | null>;
  updateStatusByToken(
    token: string,
    status: VerificationStatus,
    verifiedAt?: Date | null,
  ): Promise<IVerification | null>;
  markPendingTimedOut(discordUserId: string, guildId: string): Promise<number>;
}
