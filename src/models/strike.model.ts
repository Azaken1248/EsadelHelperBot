import { type Document, type Model, model, models, Schema } from "mongoose";

export type StrikeReason = "late" | "misc";
export type StrikeAppealStatus = "none" | "pending" | "accepted" | "denied";

export interface IStrike extends Document {
  discordUserId: string;
  issuedBy: string;
  reason: StrikeReason;
  detail: string | null;
  issuedAt: Date;
  appealStatus: StrikeAppealStatus;
  appealReason: string | null;
  appealResolvedBy: string | null;
}

const StrikeSchema = new Schema<IStrike>({
  discordUserId: { type: String, required: true, index: true },
  issuedBy: { type: String, required: true },
  reason: { type: String, required: true, enum: ["late", "misc"] },
  detail: { type: String, default: null },
  issuedAt: { type: Date, default: Date.now },
  appealStatus: { type: String, default: "none", enum: ["none", "pending", "accepted", "denied"] },
  appealReason: { type: String, default: null },
  appealResolvedBy: { type: String, default: null },
});

export const StrikeModel: Model<IStrike> =
  (models.Strike as Model<IStrike> | undefined) ?? model<IStrike>("Strike", StrikeSchema);
