import { randomUUID } from "node:crypto";
import type { Client } from "discord.js";

import type { AppConfig } from "../config/env";
import type { Logger } from "../core/logger/logger";
import { createEsadelEmbed, type EsadelTone } from "../presentation/esadel-embed";
import type { TaskReminderRepository } from "../repositories/interfaces/task-reminder-repository";
import type { UserRepository } from "../repositories/interfaces/user-repository";

const ONE_HOUR_MS = 60 * 60 * 1000;

type SendableReminderChannel = {
  send(payload: {
    content?: string;
    embeds?: unknown[];
  }): Promise<unknown>;
};

export class TaskReminderDispatcherService {
  private readonly workerId = `task-reminder-worker-${randomUUID()}`;
  private intervalHandle: NodeJS.Timeout | null = null;
  private cycleInProgress = false;
  private reminderChannelCache: { channelId: string; channel: SendableReminderChannel } | null = null;

  constructor(
    private readonly appConfig: AppConfig,
    private readonly taskReminderRepository: TaskReminderRepository,
    private readonly userRepository: UserRepository,
    private readonly discordClient: Client,
    private readonly logger: Logger,
  ) {}

  start(): void {
    if (!this.appConfig.reminders.enabled) {
      this.logger.info("Reminder dispatcher is disabled by configuration.");
      return;
    }

    if (this.intervalHandle) {
      return;
    }

    this.intervalHandle = setInterval(() => {
      void this.runDispatchCycle().catch((error) => {
        this.logCycleError(error);
      });
    }, this.appConfig.reminders.pollIntervalMs);

    this.intervalHandle.unref();
    void this.runDispatchCycle().catch((error) => {
      this.logCycleError(error);
    });

    this.logger.info("Reminder dispatcher started.", {
      pollIntervalMs: this.appConfig.reminders.pollIntervalMs,
      workerId: this.workerId,
    });
  }

  stop(): void {
    if (!this.intervalHandle) {
      return;
    }

    clearInterval(this.intervalHandle);
    this.intervalHandle = null;

    this.logger.info("Reminder dispatcher stopped.", {
      workerId: this.workerId,
    });
  }

  private async runDispatchCycle(): Promise<void> {
    if (this.cycleInProgress) {
      return;
    }

    this.cycleInProgress = true;

    try {
      const now = new Date();
      const dueReminders = await this.taskReminderRepository.claimDueReminders({
        now,
        workerId: this.workerId,
        batchSize: this.appConfig.reminders.batchSize,
        lockDurationMs: this.appConfig.reminders.lockDurationMs,
      });

      for (const reminder of dueReminders) {
        const user = await this.userRepository.findByDiscordId(reminder.discordUserId);
        if (user?.isOnHiatus) {
          // Release the lock so it can be re-claimed after hiatus ends
          await this.taskReminderRepository.markFailed(reminder.id, "User is on hiatus — reminder deferred.");
          this.logger.info("Skipped reminder for user on hiatus.", {
            reminderId: reminder.id,
            discordUserId: reminder.discordUserId,
          });
          continue;
        }

        await this.dispatchReminder(reminder.id, {
          discordUserId: reminder.discordUserId,
          taskName: reminder.taskName,
          deadline: reminder.deadline,
          offsetMinutes: reminder.offsetMinutes,
        });
      }
    } catch (error) {
      this.logCycleError(error);
    } finally {
      this.cycleInProgress = false;
    }
  }

  private logCycleError(error: unknown): void {
    const message = error instanceof Error ? error.message : "Unknown reminder dispatch cycle failure.";
    this.logger.error("Reminder dispatch cycle failed.", {
      workerId: this.workerId,
      message,
    });
  }

  private async dispatchReminder(
    reminderId: string,
    payload: {
      discordUserId: string;
      taskName: string;
      deadline: Date;
      offsetMinutes: number;
    },
  ): Promise<void> {
    try {
      const reminderChannel = await this.resolveReminderChannel();
      const deadlineUnix = Math.floor(payload.deadline.getTime() / 1000);
      const msRemaining = payload.deadline.getTime() - Date.now();
      const tone: EsadelTone = msRemaining <= ONE_HOUR_MS ? "rose" : "lavender";

      await reminderChannel.send({
        content: `<@${payload.discordUserId}>`,
        embeds: [
          createEsadelEmbed({
            title: "Task Reminder 🎀",
            description: `Task **${payload.taskName}** is waiting for your progress.`,
            tone,
            fields: [
              {
                name: "Deadline",
                value: `<t:${deadlineUnix}:f> (<t:${deadlineUnix}:R>)`,
                inline: false,
              },
              {
                name: "Reminder Offset",
                value: `${payload.offsetMinutes} minute(s) before deadline`,
                inline: true,
              },
            ],
          }),
        ],
      });

      await this.taskReminderRepository.markSent(reminderId, new Date());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown reminder dispatch failure.";

      await this.taskReminderRepository.markFailed(reminderId, message);

      this.logger.warn("Failed to send task reminder.", {
        reminderId,
        discordUserId: payload.discordUserId,
        message,
      });
    }
  }

  private async resolveReminderChannel(): Promise<SendableReminderChannel> {
    const reminderChannelId = this.appConfig.channels.remindersChannelId;

    if (!reminderChannelId) {
      throw new Error("Reminders channel is not configured.");
    }

    if (this.reminderChannelCache?.channelId === reminderChannelId) {
      return this.reminderChannelCache.channel;
    }

    const channel = await this.discordClient.channels.fetch(reminderChannelId);

    if (
      !channel ||
      !channel.isTextBased() ||
      !("send" in channel) ||
      typeof channel.send !== "function"
    ) {
      throw new Error("Configured reminders channel is unavailable or not text-based.");
    }

    const sendableChannel = channel as SendableReminderChannel;

    this.reminderChannelCache = {
      channelId: reminderChannelId,
      channel: sendableChannel,
    };

    return sendableChannel;
  }
}
