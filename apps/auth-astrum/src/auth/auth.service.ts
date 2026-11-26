import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import * as argon from "argon2";
import type { User } from "@astrum/db/client";
import { DEFAULT_LETTER_LOCALE } from "../events/constants/locale.constants";
import { EventsService } from "../events/events.service";
import type { LetterLocale } from "../events/types/events.types";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { confirmEmailToken } from "./auth.confirm";
import { resendConfirmation } from "./auth.resend";
import { revokeSession, signSessionToken } from "./auth.session";
import {
  ACCOUNT_CREATED_SESSION_UNAVAILABLE,
  EMAIL_TAKEN,
  SESSION_UNAVAILABLE,
  UNIQUE_VIOLATION_CODE,
} from "./constants/auth.constants";
import { RegisterUserDto, SignInUserDto } from "./dto";
import type { ConfirmOutcome } from "./types/auth.types";

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

  async signToken(
    userId: User["id"],
    userAgent?: string | null,
    writeFailureMessage: string = SESSION_UNAVAILABLE,
  ) {
    return await signSessionToken(
      {
        config: this.config,
        jwt: this.jwt,
        logger: this.logger,
        sessions: this.sessions,
      },
      userId,
      userAgent,
      writeFailureMessage,
    );
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
        if (err.code === UNIQUE_VIOLATION_CODE) {
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

    return await this.signToken(
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

    return await this.signToken(user.id, userAgent);
  }

  async logout(token: string | undefined): Promise<void> {
    await revokeSession(
      {
        config: this.config,
        jwt: this.jwt,
        logger: this.logger,
        sessions: this.sessions,
      },
      token,
    );
  }

  async confirm(rawToken: string | undefined): Promise<ConfirmOutcome> {
    return await confirmEmailToken(this.prisma, rawToken);
  }

  async resend(
    rawEmail: string,
    ip: string | undefined,
    locale: LetterLocale = DEFAULT_LETTER_LOCALE,
  ): Promise<void> {
    await resendConfirmation(
      {
        events: this.events,
        logger: this.logger,
        prisma: this.prisma,
        sessions: this.sessions,
      },
      rawEmail,
      ip,
      locale,
    );
  }
}
