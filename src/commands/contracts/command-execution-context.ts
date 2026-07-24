import type { AppConfig } from "../../config/env";
import type { Logger } from "../../core/logger/logger";
import type { AssignmentService } from "../../services/assignment-service";
import type { BulkAssignmentService } from "../../services/bulk-assignment-service";
import type { ConfigCacheService } from "../../services/config-cache-service";
import type { GatekeeperService } from "../../services/gatekeeper-service";
import type { KnowledgeService } from "../../services/knowledge-service";
import type { MemoryService } from "../../services/memory-service";
import type { RagService } from "../../services/rag-service";
import type { StrikeService } from "../../services/strike-service";
import type { TimezoneTranslationService } from "../../services/timezone-translation-service";
import type { UserService } from "../../services/user-service";

export interface CommandExecutionContext {
  config: AppConfig;
  logger: Logger;
  userService: UserService;
  assignmentService: AssignmentService;
  bulkAssignmentService: BulkAssignmentService;
  strikeService: StrikeService;
  configCacheService: ConfigCacheService;
  timezoneService: TimezoneTranslationService;
  gatekeeperService: GatekeeperService;
  knowledgeService: KnowledgeService;
  ragService: RagService;
  memoryService: MemoryService;
}
