import { type Document, type Model, model, models, Schema } from "mongoose";

export interface GuildConfigExtensionRules {
  maxStandardExtensions: number | null;
  blockTimeLimitedAutoExtension: boolean;
}

export interface IGuildConfig extends Document {
  guildId: string;
  ownerRoleIds: string[];
  managerRoleIds: string[];
  baseCrewRoleId: string;
  specializedRoles: Map<string, string>;
  extensionRules: GuildConfigExtensionRules;
  createdAt: Date;
  updatedAt: Date;
}

const GuildConfigSchema = new Schema<IGuildConfig>(
  {
    guildId: { type: String, required: true, unique: true },
    ownerRoleIds: { type: [String], default: [] },
    managerRoleIds: { type: [String], default: [] },
    baseCrewRoleId: { type: String, required: true },
    specializedRoles: { type: Map, of: String, default: {} },
    extensionRules: {
      maxStandardExtensions: { type: Number, default: null, min: 0 },
      blockTimeLimitedAutoExtension: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
  },
);

export const GuildConfigModel: Model<IGuildConfig> =
  (models.GuildConfig as Model<IGuildConfig> | undefined) ??
  model<IGuildConfig>("GuildConfig", GuildConfigSchema);
