import type { Client } from "discord.js";

import type { Logger } from "../logger/logger";
import type { ServiceToken } from "./container";

// ─────────────────────────────────────────────────────────────────────────────
// Forward-referenced tokens.
//
// The DI registry is the one core file that points at every other layer. To keep
// `npm run build` green during the phased scaffold, each token below is enabled
// only once its target module exists. As later phases add a module, uncomment its
// `import type` above and the matching `createToken<…>()` line below. The full,
// final token set is preserved as comments so nothing is lost.
//
//   Phase — Config:        config
//   Phase — Database/Repos: userRepository, assignmentRepository,
//                           guildConfigRepository, taskReminderRepository,
//                           verificationRepository, strikeRepository
//   Phase — Services:      userService, assignmentService, bulkAssignmentService,
//                           timezoneService, gatekeeperService, strikeService,
//                           configCacheService, taskReminderScheduleService,
//                           taskReminderBootstrapService, taskReminderDispatcherService
//   Phase — Commands:      commands, commandRegistry, commandLoader,
//                           interactionCreateHandler, submitApprovalHandler,
//                           strikeAppealHandler
//   Phase — Discord:       commandDeployer
//   Phase — App/Bootstrap: bot
// ─────────────────────────────────────────────────────────────────────────────

// import type { EsadelBot } from "../../app/bot";
// import type { CommandLoader } from "../../commands/loader/command-loader";
// import type { InteractionCreateHandler } from "../../commands/handlers/interaction-create-handler";
// import type { StrikeAppealHandler } from "../../commands/handlers/strike-appeal-handler";
// import type { SubmitApprovalHandler } from "../../commands/handlers/submit-approval-handler";
// import type { SlashCommand } from "../../commands/contracts/slash-command";
// import type { CommandRegistry } from "../../commands/registry/command-registry";
// import type { AppConfig } from "../../config/env";
// import type { CommandDeployer } from "../../discord/command-deployer";
// import type { AssignmentRepository } from "../../repositories/interfaces/assignment-repository";
// import type { GuildConfigRepository } from "../../repositories/interfaces/guild-config-repository";
// import type { StrikeRepository } from "../../repositories/interfaces/strike-repository";
// import type { TaskReminderRepository } from "../../repositories/interfaces/task-reminder-repository";
// import type { UserRepository } from "../../repositories/interfaces/user-repository";
// import type { VerificationRepository } from "../../repositories/interfaces/verification-repository";
// import type { AssignmentService } from "../../services/assignment-service";
// import type { BulkAssignmentService } from "../../services/bulk-assignment-service";
// import type { ConfigCacheService } from "../../services/config-cache-service";
// import type { GatekeeperService } from "../../services/gatekeeper-service";
// import type { StrikeService } from "../../services/strike-service";
// import type { TaskReminderBootstrapService } from "../../services/task-reminder-bootstrap-service";
// import type { TaskReminderDispatcherService } from "../../services/task-reminder-dispatcher-service";
// import type { TaskReminderScheduleService } from "../../services/task-reminder-schedule-service";
// import type { TimezoneService } from "../../services/timezone-service";
// import type { UserService } from "../../services/user-service";

const createToken = <T>(description: string): ServiceToken<T> => {
  return Symbol(description) as ServiceToken<T>;
};

export const TOKENS = {
  // Active — target modules exist as of the Core layer.
  logger: createToken<Logger>("logger"),
  discordClient: createToken<Client>("discordClient"),

  // Config
  // config: createToken<AppConfig>("config"),

  // Repositories
  // userRepository: createToken<UserRepository>("userRepository"),
  // assignmentRepository: createToken<AssignmentRepository>("assignmentRepository"),
  // guildConfigRepository: createToken<GuildConfigRepository>("guildConfigRepository"),
  // taskReminderRepository: createToken<TaskReminderRepository>("taskReminderRepository"),
  // verificationRepository: createToken<VerificationRepository>("verificationRepository"),
  // strikeRepository: createToken<StrikeRepository>("strikeRepository"),

  // Services
  // userService: createToken<UserService>("userService"),
  // taskReminderScheduleService: createToken<TaskReminderScheduleService>("taskReminderScheduleService"),
  // taskReminderBootstrapService: createToken<TaskReminderBootstrapService>("taskReminderBootstrapService"),
  // taskReminderDispatcherService: createToken<TaskReminderDispatcherService>("taskReminderDispatcherService"),
  // assignmentService: createToken<AssignmentService>("assignmentService"),
  // bulkAssignmentService: createToken<BulkAssignmentService>("bulkAssignmentService"),
  // timezoneService: createToken<TimezoneService>("timezoneService"),
  // gatekeeperService: createToken<GatekeeperService>("gatekeeperService"),
  // configCacheService: createToken<ConfigCacheService>("configCacheService"),
  // strikeService: createToken<StrikeService>("strikeService"),

  // Commands
  // commands: createToken<SlashCommand[]>("commands"),
  // commandRegistry: createToken<CommandRegistry>("commandRegistry"),
  // commandLoader: createToken<CommandLoader>("commandLoader"),
  // interactionCreateHandler: createToken<InteractionCreateHandler>("interactionCreateHandler"),
  // submitApprovalHandler: createToken<SubmitApprovalHandler>("submitApprovalHandler"),
  // strikeAppealHandler: createToken<StrikeAppealHandler>("strikeAppealHandler"),

  // Discord
  // commandDeployer: createToken<CommandDeployer>("commandDeployer"),

  // App / Bootstrap
  // bot: createToken<EsadelBot>("bot"),
} as const;
