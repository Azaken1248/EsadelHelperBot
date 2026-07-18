import type { IStrike, StrikeAppealStatus, StrikeReason } from "../../models/strike.model";

export interface CreateStrikeInput {
  discordUserId: string;
  issuedBy: string;
  reason: StrikeReason;
  detail?: string | null;
}

export interface StrikeRepository {
  create(input: CreateStrikeInput): Promise<IStrike>;
  findAll(): Promise<IStrike[]>;
  findByDiscordUserId(discordUserId: string): Promise<IStrike[]>;
  findById(id: string): Promise<IStrike | null>;
  updateAppealStatus(id: string, status: StrikeAppealStatus, appealReason?: string | null, resolvedBy?: string | null): Promise<IStrike | null>;
  deleteById(id: string): Promise<boolean>;
}
