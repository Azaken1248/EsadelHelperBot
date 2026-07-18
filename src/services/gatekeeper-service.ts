import { randomUUID } from "node:crypto";
import type { Client, GuildMember } from "discord.js";

import type { AppConfig } from "../config/env";
import type { Logger } from "../core/logger/logger";
import { createEsadelEmbed } from "../presentation/esadel-embed";
import type { VerificationRepository } from "../repositories/interfaces/verification-repository";

const VERIFY_PROMPT =
  "Hi hi~! Welcome to Project Esadel! Before we let you in, please verify your account by " +
  "solving the captcha link below. We want to keep the server safe! Hehe~ ♡";

export type VerifyMemberStatus =
  | "verified"
  | "invalidToken"
  | "wrongGuild"
  | "alreadyVerified"
  | "memberNotFound"
  | "disabled";

export interface VerifyMemberResult {
  status: VerifyMemberStatus;
  discordUserId?: string;
}

/**
 * Anti-bot verification gating (ARCHITECTURE.md §11.3).
 *
 * On join, isolates a new member with the Unverified role and DMs them a
 * one-time verification link. The web portal calls verifyMember() on captcha
 * success to swap the role. handleVerificationTimeout() sweeps members who
 * never completed verification.
 */
export class GatekeeperService {
  constructor(
    private readonly config: AppConfig,
    private readonly discordClient: Client,
    private readonly verificationRepository: VerificationRepository,
    private readonly logger: Logger,
  ) {}

  isEnabled(): boolean {
    return this.config.roles.unverified !== null;
  }

  async onMemberJoin(member: GuildMember): Promise<void> {
    const unverifiedRoleId = this.config.roles.unverified;
    if (!unverifiedRoleId) {
      this.logger.info("Gatekeeper is disabled (ROLE_UNVERIFIED_ID unset); skipping new member.", {
        discordUserId: member.id,
      });
      return;
    }

    try {
      await member.roles.add(unverifiedRoleId);
    } catch (error) {
      this.logger.warn("Failed to assign unverified role to new member.", {
        discordUserId: member.id,
        message: error instanceof Error ? error.message : "Unknown role assignment error.",
      });
    }

    const token = randomUUID();

    try {
      await this.verificationRepository.create({
        discordUserId: member.id,
        guildId: member.guild.id,
        token,
      });
    } catch (error) {
      this.logger.error("Failed to record verification for new member.", {
        discordUserId: member.id,
        message: error instanceof Error ? error.message : "Unknown verification persistence error.",
      });
      return;
    }

    const verificationUrl = this.buildVerificationUrl(token);
    const description = verificationUrl
      ? `${VERIFY_PROMPT}\n\n[**Verify here**](${verificationUrl})`
      : `${VERIFY_PROMPT}\n\n(The verification portal isn't configured yet — please reach out to an admin.)`;

    try {
      await member.send({
        embeds: [
          createEsadelEmbed({
            title: "Verify to join Project Esadel ♡",
            description,
            tone: "lavender",
            voiceWrap: false,
          }),
        ],
      });
    } catch {
      // DMs are closed — the #verify channel fallback button (wired in the
      // commands layer) will surface the link on demand.
      this.logger.info("Could not DM verification link; member must use the #verify fallback.", {
        discordUserId: member.id,
      });
    }
  }

  buildVerificationUrl(token: string): string | null {
    const base = this.config.captcha.webPortalUrl;
    if (!base) {
      return null;
    }

    return `${base.replace(/\/+$/, "")}/verify?token=${encodeURIComponent(token)}`;
  }

  async verifyMember(token: string, guildId: string): Promise<VerifyMemberResult> {
    if (!this.isEnabled()) {
      return { status: "disabled" };
    }

    const record = await this.verificationRepository.findByToken(token);
    if (!record) {
      return { status: "invalidToken" };
    }

    if (record.guildId !== guildId) {
      return { status: "wrongGuild" };
    }

    if (record.status === "VERIFIED") {
      return { status: "alreadyVerified", discordUserId: record.discordUserId };
    }

    try {
      const guild = await this.discordClient.guilds.fetch(guildId);
      const member = await guild.members.fetch(record.discordUserId);

      const unverifiedRoleId = this.config.roles.unverified;
      if (unverifiedRoleId) {
        await member.roles.remove(unverifiedRoleId);
      }

      await member.roles.add(this.config.roles.crew);
    } catch (error) {
      this.logger.warn("Verification succeeded but role swap failed.", {
        discordUserId: record.discordUserId,
        message: error instanceof Error ? error.message : "Unknown role swap error.",
      });
      return { status: "memberNotFound", discordUserId: record.discordUserId };
    }

    await this.verificationRepository.updateStatusByToken(token, "VERIFIED", new Date());

    this.logger.info("Member verified and granted crew access.", {
      discordUserId: record.discordUserId,
      guildId,
    });

    return { status: "verified", discordUserId: record.discordUserId };
  }

  async handleVerificationTimeout(discordUserId: string, guildId: string): Promise<void> {
    const timedOut = await this.verificationRepository.markPendingTimedOut(discordUserId, guildId);
    if (timedOut === 0) {
      return;
    }

    try {
      const guild = await this.discordClient.guilds.fetch(guildId);
      const member = await guild.members.fetch(discordUserId);
      await member.kick("Verification window expired.");

      this.logger.info("Kicked member for verification timeout.", { discordUserId, guildId });
    } catch (error) {
      this.logger.warn("Failed to kick member after verification timeout.", {
        discordUserId,
        message: error instanceof Error ? error.message : "Unknown kick error.",
      });
    }
  }
}
