import type { IStrike, StrikeReason } from "../models/strike.model";
import type { StrikeRepository } from "../repositories/interfaces/strike-repository";
import type { UserRepository } from "../repositories/interfaces/user-repository";
import type { Logger } from "../core/logger/logger";

export type AddStrikeStatus = "added" | "notFound" | "deboarded" | "maxStrikes";

export interface AddStrikeResult {
  status: AddStrikeStatus;
  strike?: IStrike;
  newStrikeCount: number;
}

export type RemoveStrikeStatus = "removed" | "strikeNotFound" | "userNotFound";

export interface RemoveStrikeResult {
  status: RemoveStrikeStatus;
  newStrikeCount: number;
}

export type AppealFileStatus = "filed" | "strikeNotFound" | "notOwner" | "alreadyPending" | "alreadyResolved";

export interface AppealFileResult {
  status: AppealFileStatus;
  strike?: IStrike;
}

export type AppealResolveStatus = "accepted" | "denied" | "strikeNotFound" | "notPending";

export interface AppealResolveResult {
  status: AppealResolveStatus;
  strike?: IStrike;
  newStrikeCount: number;
}

export class StrikeService {
  constructor(
    private readonly strikeRepository: StrikeRepository,
    private readonly userRepository: UserRepository,
    private readonly logger: Logger,
  ) {}

  async addStrike(
    targetDiscordId: string,
    issuedBy: string,
    reason: StrikeReason,
    detail?: string,
  ): Promise<AddStrikeResult> {
    const user = await this.userRepository.findByDiscordId(targetDiscordId);
    if (!user) {
      return { status: "notFound", newStrikeCount: 0 };
    }

    if (user.isDeboarded) {
      return { status: "deboarded", newStrikeCount: user.strikes };
    }

    if (user.strikes >= 3) {
      return { status: "maxStrikes", newStrikeCount: user.strikes };
    }

    const strike = await this.strikeRepository.create({
      discordUserId: targetDiscordId,
      issuedBy,
      reason,
      detail: detail ?? null,
    });

    const updatedUser = await this.userRepository.incrementStrikes(targetDiscordId, 1);
    const newCount = updatedUser?.strikes ?? user.strikes + 1;

    this.logger.info("Strike added.", {
      discordUserId: targetDiscordId,
      issuedBy,
      reason,
      detail: detail ?? null,
      newStrikeCount: newCount,
    });

    return { status: "added", strike, newStrikeCount: newCount };
  }

  async removeStrike(strikeId: string): Promise<RemoveStrikeResult> {
    const strike = await this.strikeRepository.findById(strikeId);
    if (!strike) {
      return { status: "strikeNotFound", newStrikeCount: 0 };
    }

    const user = await this.userRepository.findByDiscordId(strike.discordUserId);
    if (!user) {
      return { status: "userNotFound", newStrikeCount: 0 };
    }

    await this.strikeRepository.deleteById(strikeId);
    const updatedUser = await this.userRepository.incrementStrikes(strike.discordUserId, -1);
    const newCount = updatedUser?.strikes ?? Math.max(0, user.strikes - 1);

    this.logger.info("Strike removed.", {
      strikeId,
      discordUserId: strike.discordUserId,
      newStrikeCount: newCount,
    });

    return { status: "removed", newStrikeCount: newCount };
  }

  async fileAppeal(
    strikeId: string,
    discordUserId: string,
    appealReason: string,
  ): Promise<AppealFileResult> {
    const strike = await this.strikeRepository.findById(strikeId);
    if (!strike) {
      return { status: "strikeNotFound" };
    }

    if (strike.discordUserId !== discordUserId) {
      return { status: "notOwner" };
    }

    if (strike.appealStatus === "pending") {
      return { status: "alreadyPending", strike };
    }

    if (strike.appealStatus === "accepted" || strike.appealStatus === "denied") {
      return { status: "alreadyResolved", strike };
    }

    const updatedStrike = await this.strikeRepository.updateAppealStatus(
      strikeId,
      "pending",
      appealReason,
      null,
    );

    this.logger.info("Strike appeal filed.", {
      strikeId,
      discordUserId,
      appealReason,
    });

    return { status: "filed", strike: updatedStrike ?? strike };
  }

  async resolveAppeal(
    strikeId: string,
    resolvedBy: string,
    accepted: boolean,
  ): Promise<AppealResolveResult> {
    const strike = await this.strikeRepository.findById(strikeId);
    if (!strike) {
      return { status: "strikeNotFound", newStrikeCount: 0 };
    }

    if (strike.appealStatus !== "pending") {
      return { status: "notPending", newStrikeCount: 0 };
    }

    if (accepted) {
      await this.strikeRepository.updateAppealStatus(strikeId, "accepted", null, resolvedBy);

      const removeResult = await this.removeStrike(strikeId);

      this.logger.info("Strike appeal accepted — strike removed.", {
        strikeId,
        resolvedBy,
      });

      return { status: "accepted", strike, newStrikeCount: removeResult.newStrikeCount };
    }

    const updatedStrike = await this.strikeRepository.updateAppealStatus(
      strikeId,
      "denied",
      null,
      resolvedBy,
    );

    this.logger.info("Strike appeal denied.", {
      strikeId,
      resolvedBy,
    });

    const user = await this.userRepository.findByDiscordId(strike.discordUserId);

    return {
      status: "denied",
      strike: updatedStrike ?? strike,
      newStrikeCount: user?.strikes ?? 0,
    };
  }

  async getStrikesForUser(discordUserId: string): Promise<IStrike[]> {
    return this.strikeRepository.findByDiscordUserId(discordUserId);
  }

  async getAllStrikes(): Promise<IStrike[]> {
    return this.strikeRepository.findAll();
  }
}
