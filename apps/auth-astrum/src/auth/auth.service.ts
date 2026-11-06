import {
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import * as argon from "argon2";
import { createHash, randomBytes } from "node:crypto";
import type { User } from "../../generated/prisma/client";
import type { ConfirmOutcome } from "../config/auth.config";
import { EventsService } from "../events/events.service";
import { DEFAULT_LETTER_LOCALE, type LetterLocale } from "../events/locale";
import { PrismaService } from "../prisma/prisma.service";
import {
  loggedSid,
  RedisService,
  SESSION_TTL_SECONDS,
  sessionKey,
} from "../redis/redis.service";
import type { RegisterUserDto, SignInUserDto } from "./dto";

const USER_AGENT_MAX_LENGTH = 512;

const EMAIL_TAKEN = "The user already exists";

const RESEND_EMAIL_LIMIT = 3;
const RESEND_EMAIL_WINDOW_SECONDS = 900;
const RESEND_IP_LIMIT = 10;
const RESEND_IP_WINDOW_SECONDS = 3600;

const SESSION_UNAVAILABLE =
  "The session store is unavailable, so no session was started. Try again in a moment.";

const ACCOUNT_CREATED_SESSION_UNAVAILABLE =
  "The account was created, but the session store is unavailable, so no session was started. Sign in once the store answers again.";

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private sessions: RedisService,
    private events: EventsService,
  ) {}

  /**
   * Signs a token and records the session it carries. The record is written
   * first: a token whose session was never stored would be refused by the
   * gateway at the next request, so no token is issued when the write fails.
   */
  async signToken(
    userId: User["id"],
    userAgent?: string | null,
    writeFailureMessage: string = SESSION_UNAVAILABLE,
  ) {
    const sid = randomBytes(32).toString("base64url");

    try {
      await this.sessions.set(
        sessionKey(sid),
        JSON.stringify({
          userId,
          createdAt: new Date().toISOString(),
          userAgent: userAgent
            ? userAgent.slice(0, USER_AGENT_MAX_LENGTH)
            : null,
        }),
        SESSION_TTL_SECONDS,
      );
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: "session.write.failed",
          userId,
          reason: describeError(error),
        }),
      );

      throw new ServiceUnavailableException({
        code: "SESSION_STORE_UNAVAILABLE",
        message: writeFailureMessage,
      });
    }

    const payload = {
      userId: userId,
      sid: sid,
    };

    const secret = await this.config.get("JWT_SECRET");

    const token = await this.jwt.signAsync(payload, {
      expiresIn: "1d",
      secret: secret,
    });

    return { token: token, expiresIn: "1d" };
  }

  async register(
    dto: RegisterUserDto,
    userAgent?: string,
    locale: LetterLocale = DEFAULT_LETTER_LOCALE,
  ) {
    let user: User;

    try {
      const passwordhash = await argon.hash(dto.password);

      delete dto.password;

      user = await this.prisma.user.create({
        data: {
          passwordhash: passwordhash,
          ...dto,
        },
      });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError) {
        if (err.code === "P2002") {
          throw new ForbiddenException({
            code: "EMAIL_TAKEN",
            message: EMAIL_TAKEN,
          });
        }
      }
      throw err;
    }

    await this.events.requestAccountConfirmation({
      userId: user.id,
      email: user.email,
      locale,
    });

    return this.signToken(
      user.id,
      userAgent,
      ACCOUNT_CREATED_SESSION_UNAVAILABLE,
    );
  }

  async signin(dto: SignInUserDto, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });
    if (!user) throw new ForbiddenException("The user does not exist");

    const pwMatches = await argon.verify(user.passwordhash, dto.password);

    if (!pwMatches) throw new ForbiddenException("Password is incorrect");

    return this.signToken(user.id, userAgent);
  }

  /**
   * Ends the session carried by the cookie. A missing, expired or forged token
   * deletes nothing, and a store failure is logged instead of answered, so the
   * storefront can always treat logout as done.
   */
  async logout(token: string | undefined): Promise<void> {
    const sid = await this.verifiedSid(token);

    if (!sid) {
      return;
    }

    try {
      const removed = await this.sessions.del(sessionKey(sid));

      if (removed > 0) {
        this.logger.log(
          JSON.stringify({ event: "session.revoked", sid: loggedSid(sid) }),
        );
      }
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: "session.revoke.failed",
          sid: loggedSid(sid),
          reason: describeError(error),
        }),
      );
    }
  }

  /**
   * One click from the letter. Only the sha256 of the parameter reaches the
   * database, and every outcome is a value the page knows how to render.
   */
  async confirm(rawToken: string | undefined): Promise<ConfirmOutcome> {
    const token = rawToken?.trim();

    if (!token) {
      return "invalid";
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");

    const row = await this.prisma.emailToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        email: true,
        usedAt: true,
        expiresAt: true,
        user: { select: { email: true, status: true } },
      },
    });

    if (!row || row.email !== row.user.email) {
      return "invalid";
    }

    if (row.usedAt) {
      return row.user.status === "ACTIVE" ? "ok" : "used";
    }

    if (row.expiresAt.getTime() <= Date.now()) {
      return "expired";
    }

    await this.prisma.$transaction([
      this.prisma.emailToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: row.userId },
        data: { status: "ACTIVE" },
      }),
    ]);

    return "ok";
  }

  /**
   * Reveals nothing: every outcome is the same 204. The limits count unknown
   * addresses too, so the route cannot probe a mailbox for free.
   */
  async resend(
    rawEmail: string,
    ip: string | undefined,
    locale: LetterLocale = DEFAULT_LETTER_LOCALE,
  ): Promise<void> {
    const email = rawEmail.trim().toLowerCase();
    const limit = await this.hitResendLimits(email, ip);

    if (limit === "unavailable") {
      return;
    }

    if (limit) {
      this.logger.warn(
        JSON.stringify({
          event: "email.resend.rate_limited",
          email,
          limit,
        }),
      );
      return;
    }

    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, email: true, status: true },
    });

    if (!user || user.status !== "PENDING") {
      return;
    }

    await this.events.requestAccountConfirmation({
      userId: user.id,
      email: user.email,
      locale,
    });
  }

  private async hitResendLimits(
    email: string,
    ip: string | undefined,
  ): Promise<string | "unavailable" | undefined> {
    try {
      const emailHits = await this.sessions.incrementWithTtl(
        `rl:confirm:email:${email}`,
        RESEND_EMAIL_WINDOW_SECONDS,
      );

      if (emailHits > RESEND_EMAIL_LIMIT) {
        return `${RESEND_EMAIL_LIMIT} requests per ${RESEND_EMAIL_WINDOW_SECONDS / 60} minutes per address`;
      }

      if (!ip) {
        return undefined;
      }

      const ipHits = await this.sessions.incrementWithTtl(
        `rl:confirm:ip:${ip}`,
        RESEND_IP_WINDOW_SECONDS,
      );

      if (ipHits > RESEND_IP_LIMIT) {
        return `${RESEND_IP_LIMIT} requests per hour per IP`;
      }

      return undefined;
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: "email.resend.limiter.failed",
          reason: describeError(error),
        }),
      );

      return "unavailable";
    }
  }

  private async verifiedSid(
    token: string | undefined,
  ): Promise<string | undefined> {
    if (!token) {
      return undefined;
    }

    try {
      const secret = await this.config.get("JWT_SECRET");
      const payload = await this.jwt.verifyAsync<{ sid?: string }>(token, {
        secret: secret,
      });

      return payload.sid;
    } catch {
      return undefined;
    }
  }
}
