import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Logger } from "../../src/core/logger/logger";
import type { StrikeRepository } from "../../src/repositories/interfaces/strike-repository";
import type { UserRepository } from "../../src/repositories/interfaces/user-repository";
import { StrikeService } from "../../src/services/strike-service";

describe("StrikeService", () => {
  let mockStrikeRepo: Record<string, ReturnType<typeof vi.fn>>;
  let mockUserRepo: Record<string, ReturnType<typeof vi.fn>>;
  let mockLogger: Logger;
  let service: StrikeService;

  beforeEach(() => {
    mockStrikeRepo = {
      create: vi.fn(),
      findByDiscordUserId: vi.fn().mockResolvedValue([]),
      findById: vi.fn(),
      updateAppealStatus: vi.fn(),
      deleteById: vi.fn(),
    };

    mockUserRepo = {
      findByDiscordId: vi.fn(),
      incrementStrikes: vi.fn(),
    };

    mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    service = new StrikeService(
      mockStrikeRepo as unknown as StrikeRepository,
      mockUserRepo as unknown as UserRepository,
      mockLogger,
    );
  });

  describe("addStrike", () => {
    it("returns notFound when user does not exist", async () => {
      mockUserRepo.findByDiscordId.mockResolvedValue(null);

      const result = await service.addStrike("user-1", "owner-1", "late");

      expect(result.status).toBe("notFound");
    });

    it("returns deboarded when user is deboarded", async () => {
      mockUserRepo.findByDiscordId.mockResolvedValue({ isDeboarded: true, strikes: 0 });

      const result = await service.addStrike("user-1", "owner-1", "late");

      expect(result.status).toBe("deboarded");
    });

    it("returns maxStrikes when user already at 3", async () => {
      mockUserRepo.findByDiscordId.mockResolvedValue({ isDeboarded: false, strikes: 3 });

      const result = await service.addStrike("user-1", "owner-1", "misc");

      expect(result.status).toBe("maxStrikes");
    });

    it("creates strike and increments counter on success", async () => {
      mockUserRepo.findByDiscordId.mockResolvedValue({ isDeboarded: false, strikes: 1 });
      mockStrikeRepo.create.mockResolvedValue({ id: "strike-1", reason: "late" });
      mockUserRepo.incrementStrikes.mockResolvedValue({ strikes: 2 });

      const result = await service.addStrike("user-1", "owner-1", "late", "May 5th");

      expect(result.status).toBe("added");
      expect(result.newStrikeCount).toBe(2);
      expect(mockStrikeRepo.create).toHaveBeenCalledWith({
        discordUserId: "user-1",
        issuedBy: "owner-1",
        reason: "late",
        detail: "May 5th",
      });
      expect(mockUserRepo.incrementStrikes).toHaveBeenCalledWith("user-1", 1);
    });
  });

  describe("removeStrike", () => {
    it("returns strikeNotFound when strike does not exist", async () => {
      mockStrikeRepo.findById.mockResolvedValue(null);

      const result = await service.removeStrike("bad-id");

      expect(result.status).toBe("strikeNotFound");
    });

    it("returns userNotFound when user does not exist", async () => {
      mockStrikeRepo.findById.mockResolvedValue({ discordUserId: "user-1" });
      mockUserRepo.findByDiscordId.mockResolvedValue(null);

      const result = await service.removeStrike("strike-1");

      expect(result.status).toBe("userNotFound");
    });

    it("deletes strike and decrements counter on success", async () => {
      mockStrikeRepo.findById.mockResolvedValue({ discordUserId: "user-1" });
      mockUserRepo.findByDiscordId.mockResolvedValue({ strikes: 2 });
      mockStrikeRepo.deleteById.mockResolvedValue(true);
      mockUserRepo.incrementStrikes.mockResolvedValue({ strikes: 1 });

      const result = await service.removeStrike("strike-1");

      expect(result.status).toBe("removed");
      expect(result.newStrikeCount).toBe(1);
      expect(mockStrikeRepo.deleteById).toHaveBeenCalledWith("strike-1");
      expect(mockUserRepo.incrementStrikes).toHaveBeenCalledWith("user-1", -1);
    });
  });

  describe("fileAppeal", () => {
    it("returns strikeNotFound when strike does not exist", async () => {
      mockStrikeRepo.findById.mockResolvedValue(null);

      const result = await service.fileAppeal("bad-id", "user-1", "unfair");

      expect(result.status).toBe("strikeNotFound");
    });

    it("returns notOwner when user does not own the strike", async () => {
      mockStrikeRepo.findById.mockResolvedValue({ discordUserId: "user-2", appealStatus: "none" });

      const result = await service.fileAppeal("strike-1", "user-1", "unfair");

      expect(result.status).toBe("notOwner");
    });

    it("returns alreadyPending when appeal is already pending", async () => {
      mockStrikeRepo.findById.mockResolvedValue({ discordUserId: "user-1", appealStatus: "pending" });

      const result = await service.fileAppeal("strike-1", "user-1", "unfair");

      expect(result.status).toBe("alreadyPending");
    });

    it("returns alreadyResolved when appeal was already decided", async () => {
      mockStrikeRepo.findById.mockResolvedValue({ discordUserId: "user-1", appealStatus: "denied" });

      const result = await service.fileAppeal("strike-1", "user-1", "unfair");

      expect(result.status).toBe("alreadyResolved");
    });

    it("files appeal successfully", async () => {
      const strike = { discordUserId: "user-1", appealStatus: "none" };
      mockStrikeRepo.findById.mockResolvedValue(strike);
      mockStrikeRepo.updateAppealStatus.mockResolvedValue({ ...strike, appealStatus: "pending" });

      const result = await service.fileAppeal("strike-1", "user-1", "I was sick");

      expect(result.status).toBe("filed");
      expect(mockStrikeRepo.updateAppealStatus).toHaveBeenCalledWith("strike-1", "pending", "I was sick", null);
    });
  });

  describe("resolveAppeal", () => {
    it("returns strikeNotFound when strike does not exist", async () => {
      mockStrikeRepo.findById.mockResolvedValue(null);

      const result = await service.resolveAppeal("bad-id", "owner-1", true);

      expect(result.status).toBe("strikeNotFound");
    });

    it("returns notPending when appeal is not in pending state", async () => {
      mockStrikeRepo.findById.mockResolvedValue({ appealStatus: "none" });

      const result = await service.resolveAppeal("strike-1", "owner-1", true);

      expect(result.status).toBe("notPending");
    });

    it("accepts appeal — removes the strike", async () => {
      const strike = { discordUserId: "user-1", appealStatus: "pending" };
      mockStrikeRepo.findById.mockResolvedValue(strike);
      mockStrikeRepo.updateAppealStatus.mockResolvedValue({ ...strike, appealStatus: "accepted" });
      mockStrikeRepo.deleteById.mockResolvedValue(true);
      mockUserRepo.findByDiscordId.mockResolvedValue({ strikes: 2 });
      mockUserRepo.incrementStrikes.mockResolvedValue({ strikes: 1 });

      const result = await service.resolveAppeal("strike-1", "owner-1", true);

      expect(result.status).toBe("accepted");
      expect(result.newStrikeCount).toBe(1);
    });

    it("denies appeal — strike remains", async () => {
      const strike = { discordUserId: "user-1", appealStatus: "pending" };
      mockStrikeRepo.findById.mockResolvedValue(strike);
      mockStrikeRepo.updateAppealStatus.mockResolvedValue({ ...strike, appealStatus: "denied" });
      mockUserRepo.findByDiscordId.mockResolvedValue({ strikes: 2 });

      const result = await service.resolveAppeal("strike-1", "owner-1", false);

      expect(result.status).toBe("denied");
      expect(result.newStrikeCount).toBe(2);
      expect(mockStrikeRepo.deleteById).not.toHaveBeenCalled();
    });
  });

  describe("getStrikesForUser", () => {
    it("delegates to repository", async () => {
      const strikes = [{ id: "s1" }, { id: "s2" }];
      mockStrikeRepo.findByDiscordUserId.mockResolvedValue(strikes);

      const result = await service.getStrikesForUser("user-1");

      expect(result).toEqual(strikes);
      expect(mockStrikeRepo.findByDiscordUserId).toHaveBeenCalledWith("user-1");
    });
  });
});
