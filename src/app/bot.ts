import { ActivityType, Client, Events, type GuildMember } from "discord.js";

import type { ApiServer } from "../api/api-server";
import type { SlashCommand } from "../commands/contracts/slash-command";
import type { InteractionCreateHandler } from "../commands/handlers/interaction-create-handler";
import type { CommandLoader } from "../commands/loader/command-loader";
import type { AppConfig } from "../config/env";
import type { EventBus } from "../core/events/event-bus";
import {
  isLogSinkRegistrar,
  type LogEntry,
  type Logger,
  type LogLevel,
} from "../core/logger/logger";
import { err, ok, type Result } from "../core/result/result";
import { connectToDatabase, disconnectFromDatabase } from "../database/connection";
import type { CommandDeployer } from "../discord/command-deployer";
import type { ConfigCacheService } from "../services/config-cache-service";
import type { GatekeeperService } from "../services/gatekeeper-service";
import type { TaskReminderBootstrapService } from "../services/task-reminder-bootstrap-service";
import type { TaskReminderDispatcherService } from "../services/task-reminder-dispatcher-service";
import type { BotEventMap } from "./bot-events";

type SendableLogChannel = {
  send(payload: { content?: string; embeds?: unknown[] }): Promise<unknown>;
};

const AMIA_ACTIVITIES: readonly { type: ActivityType; name: string }[] = [
  { type: ActivityType.Listening, name: "25-ji, Nightcord de. ♪" },
  { type: ActivityType.Playing, name: "dress-up with the task board ♡" },
  { type: ActivityType.Watching, name: "over the crew ♪" },
  { type: ActivityType.Playing, name: "with anything cute 🎀" },
  { type: ActivityType.Watching, name: "for your next submission ♪" },
];

const PRESENCE_ROTATION_MS = 10 * 60 * 1000;

export class EsadelBot {
  private logsChannelCache: { channelId: string; channel: SendableLogChannel } | null = null;
  private shuttingDown = false;
  private presenceHandle: NodeJS.Timeout | null = null;

  constructor(
    private readonly client: Client,
    private readonly config: AppConfig,
    private readonly logger: Logger,
    private readonly commandLoader: CommandLoader,
    private readonly commandDeployer: CommandDeployer,
    private readonly interactionCreateHandler: InteractionCreateHandler,
    private readonly configCacheService: ConfigCacheService,
    private readonly taskReminderBootstrapService: TaskReminderBootstrapService,
    private readonly taskReminderDispatcherService: TaskReminderDispatcherService,
    private readonly gatekeeperService: GatekeeperService,
    private readonly eventBus: EventBus<BotEventMap>,
    private readonly apiServer: ApiServer,
  ) {}

  async start(): Promise<Result<void, Error>> {
    try {
      await connectToDatabase(this.config.mongo.uri, this.logger);

      const startupGuildId = process.env.GUILD_ID?.trim() || this.config.discord.guildId;
      await this.configCacheService.loadConfig(startupGuildId);
      try {
        await this.taskReminderBootstrapService.runStartupSync();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown reminder bootstrap failure.";
        this.logger.error("Reminder bootstrap sync failed. Continuing startup.", {
          message,
        });
      }

      const commands = this.commandLoader.load();
      this.wireEventBus(commands);
      this.registerShutdownHandlers();

      try {
        await this.apiServer.start();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown API server failure.";
        this.logger.error("HTTP API failed to start. Continuing without it.", { message });
      }

      await this.client.login(this.config.discord.token);
      return ok(undefined);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Realizes the Gateway → Event Bus → handler flow (ARCHITECTURE.md §2): the
   * Discord client publishes gateway events onto the bus, and the handlers
   * subscribe, keeping the two decoupled.
   */
  private wireEventBus(commands: readonly SlashCommand[]): void {
    this.client.once(Events.ClientReady, (readyClient) => {
      this.eventBus.emit("clientReady", { botTag: readyClient.user.tag });
    });
    this.client.on(Events.InteractionCreate, (interaction) => {
      this.eventBus.emit("interactionCreate", interaction);
    });
    if (this.gatekeeperService.isEnabled()) {
      this.client.on(Events.GuildMemberAdd, (member) => {
        this.eventBus.emit("guildMemberAdd", member);
      });
    } else {
      this.logger.info("Gatekeeper disabled (ROLE_UNVERIFIED_ID unset); skipping join listener.");
    }

    this.eventBus.on("clientReady", (payload) => {
      void this.onClientReady(payload, commands);
    });
    this.eventBus.on("interactionCreate", (interaction) => {
      void this.interactionCreateHandler.handleInteraction(interaction).catch((error) => {
        this.logger.error("Interaction handling failed.", {
          message: error instanceof Error ? error.message : "Unknown error.",
        });
      });
    });
    this.eventBus.on("guildMemberAdd", (member) => {
      void this.handleMemberJoin(member);
    });
  }

  private async onClientReady(
    payload: { botTag: string },
    commands: readonly SlashCommand[],
  ): Promise<void> {
    this.logger.info("Discord client ready.", { botTag: payload.botTag });

    await this.enableDiscordLogForwarding();

    this.startPresenceRotation();

    this.taskReminderDispatcherService.start();

    void this.commandDeployer.deploy(commands).catch((error) => {
      const message = error instanceof Error ? error.message : "Unknown deploy failure.";
      this.logger.error("Failed to deploy slash commands.", { message });
    });
  }

  /** Rotates Amia's presence/activity so her status feels alive. */
  private startPresenceRotation(): void {
    let index = 0;

    const applyPresence = (): void => {
      const activity = AMIA_ACTIVITIES[index % AMIA_ACTIVITIES.length];
      index += 1;
      if (!activity || !this.client.user) {
        return;
      }
      this.client.user.setPresence({
        status: "online",
        activities: [{ name: activity.name, type: activity.type }],
      });
    };

    applyPresence();
    this.presenceHandle = setInterval(applyPresence, PRESENCE_ROTATION_MS);
    this.presenceHandle.unref();
  }

  private async handleMemberJoin(member: GuildMember): Promise<void> {
    try {
      await this.gatekeeperService.onMemberJoin(member);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown gatekeeper failure.";
      this.logger.error("Gatekeeper failed to process new member.", {
        discordUserId: member.id,
        message,
      });
    }
  }

  private registerShutdownHandlers(): void {
    const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
      if (this.shuttingDown) {
        return;
      }
      this.shuttingDown = true;

      this.logger.info("Shutting down.", { signal });
      if (this.presenceHandle) {
        clearInterval(this.presenceHandle);
        this.presenceHandle = null;
      }
      this.taskReminderDispatcherService.stop();

      try {
        await this.apiServer.stop();
      } catch {
        // best-effort — we're exiting anyway.
      }

      try {
        await disconnectFromDatabase(this.logger);
      } catch (error) {
        this.logger.warn("Failed to disconnect from MongoDB during shutdown.", {
          message: error instanceof Error ? error.message : "Unknown error.",
        });
      }

      try {
        await this.client.destroy();
      } catch {
        // Best-effort — we're exiting anyway.
      }

      process.exit(0);
    };

    process.once("SIGINT", () => void shutdown("SIGINT"));
    process.once("SIGTERM", () => void shutdown("SIGTERM"));
  }

  private async enableDiscordLogForwarding(): Promise<void> {
    const logsChannelId = this.config.channels.logsChannelId;

    if (!logsChannelId) {
      this.logger.info("Discord log forwarding disabled. LOGS_CHANNEL_ID is not configured.");
      return;
    }

    if (!isLogSinkRegistrar(this.logger)) {
      this.logger.warn("Discord log forwarding unavailable. Logger does not support sink registration.");
      return;
    }

    const logsChannel = await this.resolveLogsChannel(logsChannelId);
    if (!logsChannel) {
      return;
    }

    this.logger.registerSink(async (entry) => {
      await this.sendLogEntryToChannel(logsChannel, entry);
    });

    this.logger.info("Discord log forwarding enabled.", {
      logsChannelId,
    });
  }

  private async resolveLogsChannel(channelId: string): Promise<SendableLogChannel | null> {
    if (this.logsChannelCache?.channelId === channelId) {
      return this.logsChannelCache.channel;
    }

    try {
      const channel = await this.client.channels.fetch(channelId);

      if (
        !channel ||
        !channel.isTextBased() ||
        !("send" in channel) ||
        typeof channel.send !== "function"
      ) {
        this.logger.error("Configured logs channel is unavailable or not text-based.", {
          logsChannelId: channelId,
        });
        return null;
      }

      const sendableChannel = channel as SendableLogChannel;

      this.logsChannelCache = {
        channelId,
        channel: sendableChannel,
      };

      return sendableChannel;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown logs channel resolution failure.";
      this.logger.error("Failed to resolve configured logs channel.", {
        logsChannelId: channelId,
        message,
      });
      return null;
    }
  }

  private async sendLogEntryToChannel(
    channel: SendableLogChannel,
    entry: LogEntry,
  ): Promise<void> {
    const emojiByLevel: Record<LogLevel, string> = {
      INFO: "🌸",
      WARN: "⚠️",
      ERROR: "🚨",
    };

    const unixTime = Math.floor(new Date(entry.timestamp).getTime() / 1000);
    let line = `${emojiByLevel[entry.level]} \`${entry.level}\` <t:${unixTime}:T> · \`${entry.scope}\` — ${entry.message}`;

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      const metadataText = this.safeStringify(entry.metadata).replace(/\s+/g, " ").trim();
      const compact = metadataText.length > 300 ? `${metadataText.slice(0, 300)}…` : metadataText;
      line += ` \`${compact}\``;
    }

    try {
      // A single compact line rather than a heavy embed — logs stay skimmable.
      await channel.send({ content: line.slice(0, 2000) });
    } catch (error) {
      // Never route this failure back through this.logger — the Discord sink is
      // registered on it, so doing so would re-enter sendLogEntryToChannel and
      // loop indefinitely while the channel stays unavailable. Log to console.
      console.error(
        "Failed to forward Esadel log line to Discord.",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  private safeStringify(metadata: Record<string, unknown>): string {
    try {
      return JSON.stringify(metadata, null, 2);
    } catch {
      return "{\n  \"error\": \"serialization-failed\"\n}";
    }
  }
}
