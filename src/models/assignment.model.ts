import { type Document, type Model, model, models, Schema, Types } from "mongoose";

export type AssignmentStatus = "PENDING" | "COMPLETED" | "LATE" | "EXCUSED";

export interface IAssignment extends Document {
  userId: Types.ObjectId;
  discordUserId: string;
  roleId: string;
  taskName: string;
  description: string;
  assignedAt: Date;
  deadline: Date;
  status: AssignmentStatus;
  isTimeLimited: boolean;
  extensionsGranted: number;
}

const AssignmentSchema = new Schema<IAssignment>({
  userId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
  discordUserId: { type: String, required: true },
  roleId: { type: String, required: true },
  taskName: { type: String, required: true },
  description: { type: String, default: "" },
  assignedAt: { type: Date, default: Date.now },
  deadline: { type: Date, required: true },
  status: {
    type: String,
    enum: ["PENDING", "COMPLETED", "LATE", "EXCUSED"],
    default: "PENDING",
  },
  isTimeLimited: { type: Boolean, default: false },
  extensionsGranted: { type: Number, default: 0 },
});

AssignmentSchema.index({ status: 1, deadline: 1 });
AssignmentSchema.index({ discordUserId: 1 });

export const AssignmentModel: Model<IAssignment> =
  (models.Assignment as Model<IAssignment> | undefined) ??
  model<IAssignment>("Assignment", AssignmentSchema);
