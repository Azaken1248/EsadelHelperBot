import type { AppConfig } from "../../config/env";
import { AmiaCommand } from "./amia/amia.command";
import { AskCommand } from "./amia/ask.command";
import { FactCommand } from "./amia/fact.command";
import { QuoteCommand } from "./amia/quote.command";
import { AppealStrikeCommand } from "./crew/appealstrike.command";
import { DeboardCommand } from "./crew/deboard.command";
import { EndHiatusCommand } from "./crew/endhiatus.command";
import { HiatusCommand } from "./crew/hiatus.command";
import type { SlashCommand } from "../contracts/slash-command";
import { OnboardCommand } from "./crew/onboard.command";
import { RemoveStrikeCommand } from "./crew/removestrike.command";
import { StrikeCommand } from "./crew/strike.command";
import { AssignCommand } from "./tasks/assign.command";
import { BulkAssignCommand } from "./tasks/bulkassign.command";
import { ExtensionCommand } from "./tasks/extension.command";
import { RemoveTaskCommand } from "./tasks/remove.command";
import { SubmitCommand } from "./tasks/submit.command";
import { TransferTaskCommand } from "./tasks/transfer.command";
import { TasksCommand } from "./tasks/tasks.command";
import { CheckFreeCommand } from "./utility/checkfree.command";
import { HelloCommand } from "./utility/hello.command";
import { HistoryCommand } from "./utility/history.command";
import { PingCommand } from "./utility/ping.command";
import { ProfileCommand } from "./utility/profile.command";
import { TimezoneCommand } from "./utility/timezone.command";
import { UptimeCommand } from "./utility/uptime.command";

// Note: HelpCommand is intentionally excluded here — it depends on the
// CommandRegistry and is registered in the bootstrap layer after the registry
// is populated.
export const buildCommandModules = (config: AppConfig): SlashCommand[] => {
  const adminRoleIds = [config.roles.owners, config.roles.mods];

  return [
    new OnboardCommand(),
    new DeboardCommand(),
    new HiatusCommand(),
    new EndHiatusCommand(),
    new AssignCommand(adminRoleIds, config.roles.specialized),
    new BulkAssignCommand(adminRoleIds, config.roles.specialized),
    new ExtensionCommand(),
    new SubmitCommand(),
    new RemoveTaskCommand(adminRoleIds),
    new TransferTaskCommand(adminRoleIds),
    new TasksCommand(adminRoleIds),
    new CheckFreeCommand(),
    new HistoryCommand(adminRoleIds, config.roles.specialized),
    new ProfileCommand(),
    new TimezoneCommand(),
    new PingCommand(),
    new UptimeCommand(),
    new HelloCommand(),
    new StrikeCommand(),
    new RemoveStrikeCommand(),
    new AppealStrikeCommand(),
    new AmiaCommand(),
    new AskCommand(),
    new FactCommand(),
    new QuoteCommand(),
  ];
};
