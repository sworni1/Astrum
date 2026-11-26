import { Logger } from "@nestjs/common";
import { describeError } from "../events/describe-error";
import { DEFAULT_LETTER_LOCALE } from "../events/constants/locale.constants";
import { EventsService } from "../events/events.service";
import type { LetterLocale } from "../events/types/events.types";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import {
  RESEND_EMAIL_LIMIT,
  RESEND_EMAIL_LIMIT_MESSAGE,
  RESEND_EMAIL_WINDOW_SECONDS,
  RESEND_IP_LIMIT,
  RESEND_IP_LIMIT_MESSAGE,
  RESEND_IP_WINDOW_SECONDS,
} from "./constants/auth.constants";
import { resendEmailKey, resendIpKey } from "./helpers/resend.helpers";

type ResendDeps = {
  prisma: PrismaService;
  sessions: RedisService;
  events: EventsService;
  logger: Logger;
};

const hitResendLimits = async (
  sessions: RedisService,
  logger: Logger,
  email: string,
  ip: string | undefined,
): Promise<string | "unavailable" | undefined> => {
  try {
    const emailHits = await sessions.incrementWithTtl(
      resendEmailKey(email),
      RESEND_EMAIL_WINDOW_SECONDS,
    );

    if (emailHits > RESEND_EMAIL_LIMIT) {
      return RESEND_EMAIL_LIMIT_MESSAGE;
    }

    if (!ip) {
      return undefined;
    }

    const ipHits = await sessions.incrementWithTtl(
      resendIpKey(ip),
      RESEND_IP_WINDOW_SECONDS,
    );

    if (ipHits > RESEND_IP_LIMIT) {
      return RESEND_IP_LIMIT_MESSAGE;
    }

    return undefined;
  } catch (error) {
    logger.error(
      JSON.stringify({
        event: "email.resend.limiter.failed",
        reason: describeError(error),
      }),
    );

    return "unavailable";
  }
};

export const resendConfirmation = async (
  { events, logger, prisma, sessions }: ResendDeps,
  rawEmail: string,
  ip: string | undefined,
  locale: LetterLocale = DEFAULT_LETTER_LOCALE,
): Promise<void> => {
  const email = rawEmail.trim().toLowerCase();
  const limit = await hitResendLimits(sessions, logger, email, ip);

  if (limit === "unavailable") {
    return;
  }

  if (limit) {
    logger.warn(
      JSON.stringify({
        event: "email.resend.rate_limited",
        email,
        limit,
      }),
    );
    return;
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, status: true },
  });

  if (user?.status !== "PENDING") {
    return;
  }

  await events.requestAccountConfirmation({
    userId: user.id,
    email: user.email,
    locale,
  });
};
