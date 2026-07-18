import { Client, Events } from "discord.js";

import type { InteractionCreateHandler } from "../commands/handlers/interaction-create-handler";
import type { CommandLoader } from "../commands/loader/command-loader";
import type { AppConfig } from "../config/env";
import {
  isLogSinkRegistrar,
  type LogEntry,
  type Logger,
  type LogLevel,
} from "../core/logger/logger";
import { connectToDatabase, disconnectFromDatabase } from "../database/connection";
import type { CommandDeployer } from "../discord/command-deployer";
import type { ConfigCacheService } from "../services/config-cache-service";
import type { GatekeeperService } from "../services/gatekeeper-service";
import type { TaskReminderBootstrapService } from "../services/task-reminder-bootstrap-service";
import type { TaskReminderDispatcherService } from "../services/task-reminder-dispatcher-service";
import { createEsadelEmbed, type EsadelTone } from "../presentation/esadel-embed";

type SendableLogChannel = {
  send(payload: { content?: string; embeds?: unknown[] }): Promise<unknown>;
};

export class EsadelBot {
  private logsChannelCache: { channelId: string; channel: SendableLogChannel } | null = null;
  private shuttingDown = false;

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
  ) {}

  async start(): Promise<void> {
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
    this.interactionCreateHandler.attach(this.client);
    this.attachGatekeeper();
    this.registerShutdownHandlers();

    this.client.once(Events.ClientReady, async (readyClient) => {
      this.logger.info("Discord client ready.", {
        botTag: readyClient.user.tag,
      });

      await this.enableDiscordLogForwarding();

      this.taskReminderDispatcherService.start();

      void this.commandDeployer.deploy(commands).catch((error) => {
        const message = error instanceof Error ? error.message : "Unknown deploy failure.";
        this.logger.error("Failed to deploy slash commands.", { message });
      });
    });

    await this.client.login(this.config.discord.token);
  }

  private registerShutdownHandlers(): void {
    const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
      if (this.shuttingDown) {
        return;
      }
      this.shuttingDown = true;

      this.logger.info("Shutting down.", { signal });
      this.taskReminderDispatcherService.stop();

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

  private attachGatekeeper(): void {
    if (!this.gatekeeperService.isEnabled()) {
      this.logger.info("Gatekeeper disabled (ROLE_UNVERIFIED_ID unset); skipping join listener.");
      return;
    }

    this.client.on(Events.GuildMemberAdd, async (member) => {
      try {
        await this.gatekeeperService.onMemberJoin(member);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown gatekeeper failure.";
        this.logger.error("Gatekeeper failed to process new member.", {
          discordUserId: member.id,
          message,
        });
      }
    });
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
    const toneByLevel: Record<LogLevel, EsadelTone> = {
      INFO: "lavender",
      WARN: "rose",
      ERROR: "twilight",
    };

    const titleByLevel: Record<LogLevel, string> = {
      INFO: "Esadel System Status 🌸",
      WARN: "Esadel System Notice ⚠️",
      ERROR: "Esadel System Alert 🚨",
    };

    const tone = toneByLevel[entry.level];
    const title = titleByLevel[entry.level];
    const unixTime = Math.floor(new Date(entry.timestamp).getTime() / 1000);

    const fields = [
      {
        name: "◈ Scope",
        value: `\`${entry.scope}\``,
        inline: true,
      },
      {
        name: "◈ Timestamp",
        value: `<t:${unixTime}:T>`,
        inline: true,
      },
    ];

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      const metadataText = this.safeStringify(entry.metadata);
      const safeMetadata = metadataText.length > 1000
        ? `${metadataText.slice(0, 1000)}\n  ...[truncated]`
        : metadataText;

      fields.push({
        name: "◈ Context Metadata",
        value: `\`\`\`json\n${safeMetadata}\n\`\`\``,
        inline: false,
      });
    }

    const embed = createEsadelEmbed({
      title,
      description: `> **${entry.message}**`,
      tone,
      fields,
      voiceWrap: false,
    });

    try {
      await channel.send({ embeds: [embed] });
    } catch (error) {
      // Never route this failure back through this.logger — the Discord sink is
      // registered on it, so doing so would re-enter sendLogEntryToChannel and
      // loop indefinitely while the channel stays unavailable. Log to console.
      console.error(
        "Failed to forward Esadel log embed to Discord.",
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
