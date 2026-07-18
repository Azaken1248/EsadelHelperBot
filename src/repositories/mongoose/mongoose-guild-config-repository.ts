import { GuildConfigModel, type IGuildConfig } from "../../models/guild-config.model";
import type {
  CreateGuildConfigInput,
  GuildConfigRepository,
} from "../interfaces/guild-config-repository";

export class MongooseGuildConfigRepository implements GuildConfigRepository {
  async findByGuildId(guildId: string): Promise<IGuildConfig | null> {
    return GuildConfigModel.findOne({ guildId }).exec();
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
