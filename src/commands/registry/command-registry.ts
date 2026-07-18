import type { SlashCommand } from "../contracts/slash-command";

export class CommandRegistry {
  private readonly commands = new Map<string, SlashCommand>();

  register(command: SlashCommand): void {
    const commandName = command.data.name;

    if (this.commands.has(commandName)) {
      throw new Error(`Duplicate command registration attempted for '${commandName}'.`);
    }

    this.commands.set(commandName, command);
  }

  get(name: string): SlashCommand | undefined {
    return this.commands.get(name);
  }

  list(): SlashCommand[] {
    return [...this.commands.values()];
  }
}
