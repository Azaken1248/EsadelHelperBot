import { describe, expect, it, vi } from "vitest";

import { BulkAssignmentService } from "../../src/services/bulk-assignment-service";
import { createMockLogger } from "../helpers/mocks";

const baseInput = {
  roleId: "role-id",
  taskName: "Draw Card",
  description: "details",
  deadline: new Date(Date.now() + 86_400_000),
  isTimeLimited: false,
};

describe("BulkAssignmentService", () => {
  it("onboards each target and assigns the task", async () => {
    const userService = { onboard: vi.fn().mockResolvedValue({ status: "created" }) };
    const assignmentService = {
      assignTask: vi
        .fn()
        .mockResolvedValueOnce({ id: "a1" })
        .mockResolvedValueOnce({ id: "a2" }),
    };

    const service = new BulkAssignmentService(
      assignmentService as never,
      userService as never,
      createMockLogger(),
    );

    const result = await service.assignBulk({
      ...baseInput,
      targets: [
        { discordUserId: "u1", username: "alice" },
        { discordUserId: "u2", username: "bob" },
      ],
    });

    expect(result.total).toBe(2);
    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(0);
    expect(userService.onboard).toHaveBeenCalledTimes(2);
    expect(assignmentService.assignTask).toHaveBeenCalledTimes(2);
    expect(result.results[0]).toMatchObject({ discordUserId: "u1", success: true, assignmentId: "a1" });
  });

  it("captures per-target failures without aborting the batch", async () => {
    const userService = { onboard: vi.fn().mockResolvedValue({ status: "created" }) };
    const assignmentService = {
      assignTask: vi
        .fn()
        .mockResolvedValueOnce({ id: "a1" })
        .mockRejectedValueOnce(new Error("on hiatus")),
    };

    const service = new BulkAssignmentService(
      assignmentService as never,
      userService as never,
      createMockLogger(),
    );

    const result = await service.assignBulk({
      ...baseInput,
      targets: [
        { discordUserId: "u1", username: "alice" },
        { discordUserId: "u2", username: "bob" },
      ],
    });

    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.results[1]).toMatchObject({ discordUserId: "u2", success: false, error: "on hiatus" });
  });
});
