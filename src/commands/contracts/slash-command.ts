import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";

import type { CommandExecutionContext } from "./command-execution-context";

export interface SlashCommand {
  readonly data:
    | SlashCommandBuilder
    | SlashCommandOptionsOnlyBuilder
    | SlashCommandSubcommandsOnlyBuilder;
  readonly requiredRoleIds?: readonly string[];
  execute(
    interaction: ChatInputCommandInteraction,
    context: CommandExecutionContext,
  ): Promise<void>;
  autocomplete?(
    interaction: AutocompleteInteraction,
    context: CommandExecutionContext,
  ): Promise<void>;
}
