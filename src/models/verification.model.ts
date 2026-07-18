import { type Document, type Model, model, models, Schema } from "mongoose";

export type VerificationStatus = "PENDING" | "VERIFIED" | "FAILED" | "TIMED_OUT";

export interface IVerification extends Document {
  discordUserId: string;
  guildId: string;
  token: string;
  status: VerificationStatus;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const VerificationSchema = new Schema<IVerification>(
  {
    discordUserId: { type: String, required: true },
    guildId: { type: String, required: true },
    token: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ["PENDING", "VERIFIED", "FAILED", "TIMED_OUT"],
      default: "PENDING",
    },
    verifiedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  },
);

VerificationSchema.index({ discordUserId: 1, guildId: 1 });
VerificationSchema.index({ status: 1 });

export const VerificationModel: Model<IVerification> =
  (models.Verification as Model<IVerification> | undefined) ??
  model<IVerification>("Verification", VerificationSchema);
