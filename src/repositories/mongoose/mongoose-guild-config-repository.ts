import { GuildConfigModel, type IGuildConfig } from "../../models/guild-config.model";
import type {
  CreateGuildConfigInput,
  GuildConfigRepository,
  UpdateGuildConfigInput,
} from "../interfaces/guild-config-repository";

export class MongooseGuildConfigRepository implements GuildConfigRepository {
  async findByGuildId(guildId: string): Promise<IGuildConfig | null> {
    return GuildConfigModel.findOne({ guildId }).exec();
  }

  async update(guildId: string, patch: UpdateGuildConfigInput): Promise<IGuildConfig | null> {
    const set: Record<string, unknown> = {};
    if (patch.ownerRoleIds !== undefined) set.ownerRoleIds = patch.ownerRoleIds;
    if (patch.managerRoleIds !== undefined) set.managerRoleIds = patch.managerRoleIds;
    if (patch.baseCrewRoleId !== undefined) set.baseCrewRoleId = patch.baseCrewRoleId;
    if (patch.specializedRoles !== undefined) set.specializedRoles = patch.specializedRoles;
    if (patch.maxStandardExtensions !== undefined) {
      set["extensionRules.maxStandardExtensions"] = patch.maxStandardExtensions;
    }
    if (patch.blockTimeLimitedAutoExtension !== undefined) {
      set["extensionRules.blockTimeLimitedAutoExtension"] = patch.blockTimeLimitedAutoExtension;
    }

    return GuildConfigModel.findOneAndUpdate({ guildId }, { $set: set }, { new: true }).exec();
  }

  async create(input: CreateGuildConfigInput): Promise<IGuildConfig> {
    return GuildConfigModel.create({
      guildId: input.guildId,
      ownerRoleIds: input.ownerRoleIds,
      managerRoleIds: input.managerRoleIds,
      baseCrewRoleId: input.baseCrewRoleId,
      specializedRoles: input.specializedRoles,
      extensionRules: {
        maxStandardExtensions: input.maxStandardExtensions,
        blockTimeLimitedAutoExtension: input.blockTimeLimitedAutoExtension,
      },
    });
  }
}
