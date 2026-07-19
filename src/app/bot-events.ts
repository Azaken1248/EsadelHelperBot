import type { GuildMember, Interaction } from "discord.js";

/**
 * Typed events carried on the application Event Bus (ARCHITECTURE.md §2).
 *
 * The Discord gateway publishes onto this bus and the handlers subscribe, so the
 * gateway wiring stays decoupled from the interaction/gatekeeper logic.
 */
export type BotEventMap = {
  clientReady: { botTag: string };
  interactionCreate: Interaction;
  guildMemberAdd: GuildMember;
};
