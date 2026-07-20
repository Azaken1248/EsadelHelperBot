import { describe, expect, it } from "vitest";

import { buildCommandModules } from "../../src/commands/modules";
import { createTestConfig } from "../helpers/mocks";

describe("Infrastructure & Command Registration", () => {
  describe("buildCommandModules", () => {
    it("includes all expected command names", () => {
      const config = createTestConfig();
      const modules = buildCommandModules(config);

      const names = modules.map((command) => command.data.name).sort();

      expect(names).toEqual([
        "amia",
        "appealstrike",
        "ask",
        "assign",
        "bulkassign",
        "checkfree",
        "deboard",
        "endhiatus",
        "extend",
        "fact",
        "hello",
        "hiatus",
        "history",
        "onboard",
        "ping",
        "profile",
        "quote",
        "remove-task",
        "removestrike",
        "strike",
        "submit",
        "tasks",
        "time",
        "timezone",
        "transfer-task",
        "uptime",
      ]);
    });

    it("ensures every registered command meets structural integrity requirements", () => {
      const config = createTestConfig();
      const modules = buildCommandModules(config);

      expect(modules.length).toBeGreaterThan(0);

      for (const command of modules) {
        expect(command.data, `Command ${command.constructor.name} is missing data property`).toBeDefined();

        expect(command.data.name?.length).toBeGreaterThan(0);
        expect(command.data.description?.length).toBeGreaterThan(0);

        expect(typeof command.execute).toBe("function");

        if ("requiredRoleIds" in command) {
          expect(Array.isArray(command.requiredRoleIds)).toBe(true);
        }
      }
    });

    it("properly passes configuration to commands that require it", () => {
      const config = createTestConfig();
      const modules = buildCommandModules(config);

      const assignCommand = modules.find((m) => m.data.name === "assign") as unknown as {
        requiredRoleIds: string[];
      };
      expect(assignCommand).toBeDefined();
      expect(assignCommand.requiredRoleIds).toContain(config.roles.owners);

      const removeCommand = modules.find((m) => m.data.name === "remove-task") as unknown as {
        requiredRoleIds: string[];
      };
      expect(removeCommand).toBeDefined();
      expect(removeCommand.requiredRoleIds).toContain(config.roles.owners);
    });
  });
});
