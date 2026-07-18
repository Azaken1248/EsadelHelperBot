import type { SlashCommand } from "../contracts/slash-command";
import { CommandRegistry } from "../registry/command-registry";

export class CommandLoader {
  private isLoaded = false;

  constructor(
    private readonly commandRegistry: CommandRegistry,
    private readonly commands: readonly SlashCommand[],
  ) {}

  load(): readonly SlashCommand[] {
    if (this.isLoaded) {
      return this.commands;
    }

    for (const command of this.commands) {
      this.commandRegistry.register(command);
    }

    this.isLoaded = true;
    return this.commands;
  }
}
