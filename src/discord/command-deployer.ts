import { REST, Routes } from "discord.js";

import type { AppConfig } from "../config/env";
import type { Logger } from "../core/logger/logger";
import type { SlashCommand } from "../commands/contracts/slash-command";

export class CommandDeployer {
  constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger,
  ) {}

  async deploy(commands: readonly SlashCommand[]): Promise<void> {
    const rest = new REST({ version: "10" }).setToken(this.config.discord.token);

    const payload = commands.map((command) => command.data.toJSON());

    await rest.put(
      Routes.applicationGuildCommands(
        this.config.discord.applicationId,
        this.config.discord.guildId,
      ),
      {
        body: payload,
      },
    );

    this.logger.info("Slash commands deployed.", {
      commandCount: commands.length,
      guildId: this.config.discord.guildId,
    });
  }
}
