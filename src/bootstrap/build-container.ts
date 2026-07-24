import { Client, GatewayIntentBits } from "discord.js";

import { ApiServer } from "../api/api-server";
import { EsadelBot } from "../app/bot";
import type { BotEventMap } from "../app/bot-events";
import { createEventBus } from "../core/events/event-bus";
import { InteractionCreateHandler } from "../commands/handlers/interaction-create-handler";
import { StrikeAppealHandler } from "../commands/handlers/strike-appeal-handler";
import { SubmitApprovalHandler } from "../commands/handlers/submit-approval-handler";
import { CommandLoader } from "../commands/loader/command-loader";
import { buildCommandModules } from "../commands/modules";
import { HelpCommand } from "../commands/modules/utility/help.command";
import { CommandRegistry } from "../commands/registry/command-registry";
import { loadAppConfig } from "../config/env";
import { ServiceContainer } from "../core/di/container";
import { TOKENS } from "../core/di/tokens";
import { LogBroadcaster } from "../core/logger/log-broadcaster";
import { createLogger } from "../core/logger/logger";
import { CommandDeployer } from "../discord/command-deployer";
import { MongooseAssignmentRepository } from "../repositories/mongoose/mongoose-assignment-repository";
import { MongooseGuildConfigRepository } from "../repositories/mongoose/mongoose-guild-config-repository";
import { MongooseStrikeRepository } from "../repositories/mongoose/mongoose-strike-repository";
import { MongooseTaskReminderRepository } from "../repositories/mongoose/mongoose-task-reminder-repository";
import { MongooseMemoryRepository } from "../repositories/mongoose/mongoose-memory-repository";
import { MongooseUserRepository } from "../repositories/mongoose/mongoose-user-repository";
import { MongooseVerificationRepository } from "../repositories/mongoose/mongoose-verification-repository";
import { AssignmentService } from "../services/assignment-service";
import { BulkAssignmentService } from "../services/bulk-assignment-service";
import { ConfigCacheService } from "../services/config-cache-service";
import { OllamaLlmClient } from "../llm/llm-client";
import { GatekeeperService } from "../services/gatekeeper-service";
import { KnowledgeService } from "../services/knowledge-service";
import { MemoryService } from "../services/memory-service";
import { RagService } from "../services/rag-service";
import { StrikeService } from "../services/strike-service";
import { TaskReminderBootstrapService } from "../services/task-reminder-bootstrap-service";
import { TaskReminderDispatcherService } from "../services/task-reminder-dispatcher-service";
import { TaskReminderScheduleService } from "../services/task-reminder-schedule-service";
import { TimezoneTranslationService } from "../services/timezone-translation-service";
import { UserService } from "../services/user-service";

export const buildContainer = (): ServiceContainer => {
  const container = new ServiceContainer();

  container.registerSingleton(TOKENS.config, () => loadAppConfig());
  container.registerSingleton(TOKENS.logger, () => createLogger("EsadelBot"));
  container.registerSingleton(TOKENS.logBroadcaster, () => new LogBroadcaster());
  container.registerSingleton(TOKENS.eventBus, () => createEventBus<BotEventMap>());

  container.registerSingleton(
    TOKENS.discordClient,
    () =>
      new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
      }),
  );

  container.registerSingleton(TOKENS.userRepository, () => new MongooseUserRepository());
  container.registerSingleton(
    TOKENS.assignmentRepository,
    () => new MongooseAssignmentRepository(),
  );
  container.registerSingleton(
    TOKENS.guildConfigRepository,
    () => new MongooseGuildConfigRepository(),
  );
  container.registerSingleton(
    TOKENS.taskReminderRepository,
    () => new MongooseTaskReminderRepository(),
  );
  container.registerSingleton(
    TOKENS.strikeRepository,
    () => new MongooseStrikeRepository(),
  );
  container.registerSingleton(
    TOKENS.memoryRepository,
    () => new MongooseMemoryRepository(),
  );
  container.registerSingleton(
    TOKENS.verificationRepository,
    () => new MongooseVerificationRepository(),
  );

  container.registerSingleton(
    TOKENS.userService,
    (resolver) =>
      new UserService(
        resolver.resolve(TOKENS.userRepository),
        resolver.resolve(TOKENS.assignmentRepository),
        resolver.resolve(TOKENS.taskReminderScheduleService),
        resolver.resolve(TOKENS.logger),
      ),
  );

  container.registerSingleton(
    TOKENS.taskReminderScheduleService,
    (resolver) =>
      new TaskReminderScheduleService(
        resolver.resolve(TOKENS.config),
        resolver.resolve(TOKENS.taskReminderRepository),
        resolver.resolve(TOKENS.logger),
      ),
  );

  container.registerSingleton(
    TOKENS.taskReminderBootstrapService,
    (resolver) =>
      new TaskReminderBootstrapService(
        resolver.resolve(TOKENS.assignmentRepository),
        resolver.resolve(TOKENS.taskReminderScheduleService),
        resolver.resolve(TOKENS.logger),
      ),
  );

  container.registerSingleton(
    TOKENS.taskReminderDispatcherService,
    (resolver) =>
      new TaskReminderDispatcherService(
        resolver.resolve(TOKENS.config),
        resolver.resolve(TOKENS.taskReminderRepository),
        resolver.resolve(TOKENS.userRepository),
        resolver.resolve(TOKENS.discordClient),
        resolver.resolve(TOKENS.logger),
      ),
  );

  container.registerSingleton(
    TOKENS.assignmentService,
    (resolver) =>
      new AssignmentService(
        resolver.resolve(TOKENS.assignmentRepository),
        resolver.resolve(TOKENS.userRepository),
        resolver.resolve(TOKENS.taskReminderScheduleService),
        resolver.resolve(TOKENS.logger),
      ),
  );

  container.registerSingleton(
    TOKENS.bulkAssignmentService,
    (resolver) =>
      new BulkAssignmentService(
        resolver.resolve(TOKENS.assignmentService),
        resolver.resolve(TOKENS.userService),
        resolver.resolve(TOKENS.logger),
      ),
  );

  container.registerSingleton(
    TOKENS.timezoneService,
    () => new TimezoneTranslationService(),
  );

  container.registerSingleton(
    TOKENS.knowledgeService,
    () => new KnowledgeService(),
  );

  container.registerSingleton(
    TOKENS.llmClient,
    (resolver) =>
      new OllamaLlmClient(
        resolver.resolve(TOKENS.config).llm,
        resolver.resolve(TOKENS.logger),
      ),
  );

  container.registerSingleton(
    TOKENS.memoryService,
    (resolver) =>
      new MemoryService(
        resolver.resolve(TOKENS.memoryRepository),
        resolver.resolve(TOKENS.logger),
      ),
  );

  container.registerSingleton(
    TOKENS.ragService,
    (resolver) =>
      new RagService(
        resolver.resolve(TOKENS.knowledgeService),
        resolver.resolve(TOKENS.llmClient),
        resolver.resolve(TOKENS.logger),
        resolver.resolve(TOKENS.memoryService),
      ),
  );

  container.registerSingleton(
    TOKENS.gatekeeperService,
    (resolver) =>
      new GatekeeperService(
        resolver.resolve(TOKENS.config),
        resolver.resolve(TOKENS.discordClient),
        resolver.resolve(TOKENS.verificationRepository),
        resolver.resolve(TOKENS.logger),
      ),
  );

  container.registerSingleton(
    TOKENS.configCacheService,
    (resolver) =>
      new ConfigCacheService(
        resolver.resolve(TOKENS.guildConfigRepository),
        resolver.resolve(TOKENS.config),
        resolver.resolve(TOKENS.logger),
      ),
  );

  container.registerSingleton(
    TOKENS.strikeService,
    (resolver) =>
      new StrikeService(
        resolver.resolve(TOKENS.strikeRepository),
        resolver.resolve(TOKENS.userRepository),
        resolver.resolve(TOKENS.logger),
      ),
  );

  container.registerSingleton(TOKENS.commands, (resolver) => {
    const registry = resolver.resolve(TOKENS.commandRegistry);
    return [
      ...buildCommandModules(resolver.resolve(TOKENS.config)),
      new HelpCommand(registry),
    ];
  });

  container.registerSingleton(TOKENS.commandRegistry, () => new CommandRegistry());

  container.registerSingleton(
    TOKENS.commandLoader,
    (resolver) =>
      new CommandLoader(
        resolver.resolve(TOKENS.commandRegistry),
        resolver.resolve(TOKENS.commands),
      ),
  );

  container.registerSingleton(
    TOKENS.commandDeployer,
    (resolver) =>
      new CommandDeployer(resolver.resolve(TOKENS.config), resolver.resolve(TOKENS.logger)),
  );

  container.registerSingleton(
    TOKENS.submitApprovalHandler,
    (resolver) =>
      new SubmitApprovalHandler(
        resolver.resolve(TOKENS.assignmentService),
        resolver.resolve(TOKENS.config),
        resolver.resolve(TOKENS.logger),
      ),
  );

  container.registerSingleton(
    TOKENS.strikeAppealHandler,
    (resolver) =>
      new StrikeAppealHandler(
        resolver.resolve(TOKENS.strikeService),
        resolver.resolve(TOKENS.config),
        resolver.resolve(TOKENS.logger),
      ),
  );

  container.registerSingleton(
    TOKENS.interactionCreateHandler,
    (resolver) =>
      new InteractionCreateHandler(
        resolver.resolve(TOKENS.commandRegistry),
        {
          config: resolver.resolve(TOKENS.config),
          logger: resolver.resolve(TOKENS.logger),
          userService: resolver.resolve(TOKENS.userService),
          assignmentService: resolver.resolve(TOKENS.assignmentService),
          bulkAssignmentService: resolver.resolve(TOKENS.bulkAssignmentService),
          strikeService: resolver.resolve(TOKENS.strikeService),
          configCacheService: resolver.resolve(TOKENS.configCacheService),
          timezoneService: resolver.resolve(TOKENS.timezoneService),
          gatekeeperService: resolver.resolve(TOKENS.gatekeeperService),
          knowledgeService: resolver.resolve(TOKENS.knowledgeService),
          ragService: resolver.resolve(TOKENS.ragService),
          memoryService: resolver.resolve(TOKENS.memoryService),
        },
        resolver.resolve(TOKENS.submitApprovalHandler),
        resolver.resolve(TOKENS.strikeAppealHandler),
        resolver.resolve(TOKENS.userRepository),
        resolver.resolve(TOKENS.logger),
      ),
  );

  container.registerSingleton(
    TOKENS.apiServer,
    (resolver) =>
      new ApiServer(
        resolver.resolve(TOKENS.config),
        resolver.resolve(TOKENS.logger),
        resolver.resolve(TOKENS.logBroadcaster),
        resolver.resolve(TOKENS.guildConfigRepository),
        resolver.resolve(TOKENS.configCacheService),
        resolver.resolve(TOKENS.gatekeeperService),
      ),
  );

  container.registerSingleton(
    TOKENS.bot,
    (resolver) =>
      new EsadelBot(
        resolver.resolve(TOKENS.discordClient),
        resolver.resolve(TOKENS.config),
        resolver.resolve(TOKENS.logger),
        resolver.resolve(TOKENS.commandLoader),
        resolver.resolve(TOKENS.commandDeployer),
        resolver.resolve(TOKENS.interactionCreateHandler),
        resolver.resolve(TOKENS.configCacheService),
        resolver.resolve(TOKENS.taskReminderBootstrapService),
        resolver.resolve(TOKENS.taskReminderDispatcherService),
        resolver.resolve(TOKENS.gatekeeperService),
        resolver.resolve(TOKENS.eventBus),
        resolver.resolve(TOKENS.apiServer),
      ),
  );

  return container;
};
