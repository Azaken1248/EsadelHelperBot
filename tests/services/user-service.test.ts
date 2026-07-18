import { describe, expect, it, vi } from "vitest";

import { UserService } from "../../src/services/user-service";
import { createMockLogger } from "../helpers/mocks";

const createMockReminderService = () => ({
  scheduleForAssignment: vi.fn(),
  rescheduleForAssignment: vi.fn(),
  cancelRemindersForAssignment: vi.fn(),
  scheduleForAssignments: vi.fn(),
});

describe("UserService", () => {
  it("creates a new user during onboarding when none exists", async () => {
    const createdUser = {
      id: "user-id",
      discordId: "123",
      username: "alice",
      isDeboarded: false,
      joinedAt: new Date("2026-01-01T00:00:00.000Z"),
    };

    const userRepository = {
      findByDiscordId: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(createdUser),
      reactivate: vi.fn(),
      markDeboarded: vi.fn(),
      setHiatus: vi.fn(),
      appendAssignment: vi.fn(),
    };

    const assignmentRepository = {
      countByDiscordUserId: vi.fn(),
    };

    const service = new UserService(
      userRepository as never,
      assignmentRepository as never,
      createMockReminderService() as never,
      createMockLogger(),
    );

    const result = await service.onboard("123", "alice");

    expect(result.status).toBe("created");
    expect(userRepository.create).toHaveBeenCalledWith({ discordId: "123", username: "alice" });
  });

  it("reactivates a deboarded user during onboarding", async () => {
    const existingUser = {
      id: "user-id",
      discordId: "123",
      username: "old",
      isDeboarded: true,
    };
    const reactivatedUser = {
      ...existingUser,
      username: "new-name",
      isDeboarded: false,
      joinedAt: new Date("2026-01-01T00:00:00.000Z"),
    };

    const userRepository = {
      findByDiscordId: vi.fn().mockResolvedValue(existingUser),
      create: vi.fn(),
      reactivate: vi.fn().mockResolvedValue(reactivatedUser),
      markDeboarded: vi.fn(),
      setHiatus: vi.fn(),
      appendAssignment: vi.fn(),
    };

    const assignmentRepository = {
      countByDiscordUserId: vi.fn(),
    };

    const service = new UserService(
      userRepository as never,
      assignmentRepository as never,
      createMockReminderService() as never,
      createMockLogger(),
    );

    const result = await service.onboard("123", "new-name");

    expect(result.status).toBe("reactivated");
    expect(userRepository.reactivate).toHaveBeenCalledWith("123", "new-name");
  });

  it("returns alreadyActive when user is already active", async () => {
    const existingUser = {
      id: "user-id",
      discordId: "123",
      username: "alice",
      isDeboarded: false,
      joinedAt: new Date("2026-01-01T00:00:00.000Z"),
    };

    const userRepository = {
      findByDiscordId: vi.fn().mockResolvedValue(existingUser),
      create: vi.fn(),
      reactivate: vi.fn(),
      markDeboarded: vi.fn(),
      setHiatus: vi.fn(),
      appendAssignment: vi.fn(),
    };

    const assignmentRepository = {
      countByDiscordUserId: vi.fn(),
    };

    const service = new UserService(
      userRepository as never,
      assignmentRepository as never,
      createMockReminderService() as never,
      createMockLogger(),
    );

    const result = await service.onboard("123", "alice");

    expect(result.status).toBe("alreadyActive");
    expect(result.user).toBe(existingUser);
  });

  it("returns notFound on deboard when profile does not exist", async () => {
    const userRepository = {
      findByDiscordId: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      reactivate: vi.fn(),
      markDeboarded: vi.fn(),
      setHiatus: vi.fn(),
      appendAssignment: vi.fn(),
    };

    const assignmentRepository = {
      countByDiscordUserId: vi.fn(),
    };

    const service = new UserService(
      userRepository as never,
      assignmentRepository as never,
      createMockReminderService() as never,
      createMockLogger(),
    );

    const result = await service.deboard("123", "reason");

    expect(result).toEqual({ status: "notFound", user: null });
  });

  it("marks user as deboarded when active", async () => {
    const existingUser = {
      id: "user-id",
      discordId: "123",
      username: "alice",
      isDeboarded: false,
    };
    const deboardedUser = {
      ...existingUser,
      isDeboarded: true,
    };

    const userRepository = {
      findByDiscordId: vi.fn().mockResolvedValue(existingUser),
      create: vi.fn(),
      reactivate: vi.fn(),
      markDeboarded: vi.fn().mockResolvedValue(deboardedUser),
      setHiatus: vi.fn(),
      appendAssignment: vi.fn(),
    };

    const assignmentRepository = {
      countByDiscordUserId: vi.fn(),
    };

    const service = new UserService(
      userRepository as never,
      assignmentRepository as never,
      createMockReminderService() as never,
      createMockLogger(),
    );

    const result = await service.deboard("123", "bye");

    expect(result).toEqual({ status: "deboarded", user: deboardedUser });
    expect(userRepository.markDeboarded).toHaveBeenCalledWith("123", "bye");
  });

  it("returns profile with assignment stats", async () => {
    const user = {
      id: "user-id",
      discordId: "123",
      username: "alice",
      joinedAt: new Date("2026-01-01T00:00:00.000Z"),
      isDeboarded: false,
      isOnHiatus: false,
      strikes: 0,
    };

    const userRepository = {
      findByDiscordId: vi.fn().mockResolvedValue(user),
      create: vi.fn(),
      reactivate: vi.fn(),
      markDeboarded: vi.fn(),
      setHiatus: vi.fn(),
      appendAssignment: vi.fn(),
    };

    const assignmentRepository = {
      countByDiscordUserId: vi.fn((_: string, status?: string) => {
        if (status === "PENDING") return Promise.resolve(2);
        if (status === "COMPLETED") return Promise.resolve(5);
        if (status === "LATE") return Promise.resolve(1);
        if (status === "EXCUSED") return Promise.resolve(1);
        return Promise.resolve(9);
      }),
    };

    const service = new UserService(
      userRepository as never,
      assignmentRepository as never,
      createMockReminderService() as never,
      createMockLogger(),
    );

    const profile = await service.getProfile("123");

    expect(profile?.user).toBe(user);
    expect(profile?.assignmentStats).toEqual({
      total: 9,
      pending: 2,
      completed: 5,
      late: 1,
      excused: 1,
    });
  });

  it("startHiatus sets hiatus with timestamp and cancels reminders", async () => {
    const updatedUser = { discordId: "123", isDeboarded: false, isOnHiatus: true };
    const userRepository = {
      findByDiscordId: vi.fn().mockResolvedValue({ discordId: "123", isDeboarded: false, isOnHiatus: false }),
      setHiatus: vi.fn().mockResolvedValue(updatedUser),
    };

    const assignmentRepository = {
      pushDeadlinesByDiscordUserId: vi.fn(),
      findPendingByDiscordUserId: vi.fn().mockResolvedValue([{ id: "a1" }, { id: "a2" }]),
    };

    const mockReminderService = createMockReminderService();

    const service = new UserService(
      userRepository as never,
      assignmentRepository as never,
      mockReminderService as never,
      createMockLogger(),
    );

    const result = await service.startHiatus("123");

    expect(result.status).toBe("started");
    expect(userRepository.setHiatus).toHaveBeenCalledWith("123", true, expect.any(Date), null);
    expect(mockReminderService.cancelRemindersForAssignment).toHaveBeenCalledTimes(2);
  });

  it("endHiatus pushes deadlines and reschedules reminders", async () => {
    const hiatusStart = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
    const updatedUser = { discordId: "123", isOnHiatus: false };

    const userRepository = {
      findByDiscordId: vi.fn().mockResolvedValue({
        discordId: "123",
        isOnHiatus: true,
        hiatusStartedAt: hiatusStart,
      }),
      setHiatus: vi.fn().mockResolvedValue(updatedUser),
    };

    const assignmentRepository = {
      pushDeadlinesByDiscordUserId: vi.fn().mockResolvedValue(2),
      findPendingByDiscordUserId: vi.fn().mockResolvedValue([{ id: "a1" }, { id: "a2" }]),
    };

    const mockReminderService = createMockReminderService();

    const service = new UserService(
      userRepository as never,
      assignmentRepository as never,
      mockReminderService as never,
      createMockLogger(),
    );

    const result = await service.endHiatus("123");

    expect(result.status).toBe("ended");
    expect(result.deadlinesAffected).toBe(2);
    expect(userRepository.setHiatus).toHaveBeenCalledWith("123", false, null, null);
    expect(mockReminderService.rescheduleForAssignment).toHaveBeenCalledTimes(2);
  });

  describe("timezone", () => {
    it("setTimezone persists and returns updated status", async () => {
      const updatedUser = { discordId: "123", timezone: "America/New_York" };
      const userRepository = {
        setTimezone: vi.fn().mockResolvedValue(updatedUser),
      };

      const service = new UserService(
        userRepository as never,
        {} as never,
        createMockReminderService() as never,
        createMockLogger(),
      );

      const result = await service.setTimezone("123", "America/New_York");

      expect(result.status).toBe("updated");
      expect(result.user).toBe(updatedUser);
      expect(userRepository.setTimezone).toHaveBeenCalledWith("123", "America/New_York");
    });

    it("setTimezone returns notFound when the user does not exist", async () => {
      const userRepository = {
        setTimezone: vi.fn().mockResolvedValue(null),
      };

      const service = new UserService(
        userRepository as never,
        {} as never,
        createMockReminderService() as never,
        createMockLogger(),
      );

      const result = await service.setTimezone("missing", "UTC");

      expect(result.status).toBe("notFound");
      expect(result.user).toBeNull();
    });

    it("getTimezone returns the stored timezone", async () => {
      const userRepository = {
        findByDiscordId: vi.fn().mockResolvedValue({ discordId: "123", timezone: "Europe/London" }),
      };

      const service = new UserService(
        userRepository as never,
        {} as never,
        createMockReminderService() as never,
        createMockLogger(),
      );

      const result = await service.getTimezone("123");

      expect(result.status).toBe("found");
      expect(result.timezone).toBe("Europe/London");
    });

    it("getTimezone returns notFound for unknown users", async () => {
      const userRepository = {
        findByDiscordId: vi.fn().mockResolvedValue(null),
      };

      const service = new UserService(
        userRepository as never,
        {} as never,
        createMockReminderService() as never,
        createMockLogger(),
      );

      const result = await service.getTimezone("missing");

      expect(result.status).toBe("notFound");
      expect(result.timezone).toBeNull();
    });
  });
});
