import type { IGuildConfig } from "../../models/guild-config.model";

export interface CreateGuildConfigInput {
  guildId: string;
  ownerRoleIds: string[];
  managerRoleIds: string[];
  baseCrewRoleId: string;
  specializedRoles: Record<string, string>;
  maxStandardExtensions: number | null;
  blockTimeLimitedAutoExtension: boolean;
}

export interface GuildConfigRepository {
  findByGuildId(guildId: string): Promise<IGuildConfig | null>;
  create(input: CreateGuildConfigInput): Promise<IGuildConfig>;
}
