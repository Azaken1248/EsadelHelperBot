import { type Document, type Model, model, models, Schema } from "mongoose";

export type MemoryKind = "interest" | "preference" | "fact" | "style";

export interface IMemory extends Document {
  discordUserId: string;
  text: string;
  kind: MemoryKind;
  // strength = how many times this was (re)learned; refCount = how many times it
  // has surfaced/been referenced. Both feed the activation score.
  strength: number;
  refCount: number;
  lastReferencedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MemorySchema = new Schema<IMemory>(
  {
    discordUserId: { type: String, required: true },
    text: { type: String, required: true },
    kind: {
      type: String,
      enum: ["interest", "preference", "fact", "style"],
      default: "interest",
    },
    strength: { type: Number, default: 1, min: 0 },
    refCount: { type: Number, default: 0, min: 0 },
    lastReferencedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  },
);

// One row per distinct fact per user — writing the same memory reinforces it.
MemorySchema.index({ discordUserId: 1, text: 1 }, { unique: true });
MemorySchema.index({ discordUserId: 1, lastReferencedAt: -1 });

export const MemoryModel: Model<IMemory> =
  (models.Memory as Model<IMemory> | undefined) ?? model<IMemory>("Memory", MemorySchema);
