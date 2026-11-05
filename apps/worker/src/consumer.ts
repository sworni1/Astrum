import type { ConfirmChannel, ConsumeMessage } from "amqplib";
import type { PrismaClient } from "../generated/prisma/client";
import { buildConfirmationLetter } from "./letter";
import { describeError, logger } from "./logger";
import type { Mailer } from "./mailer";
import { confirmationLink } from "./token";
import { mintConfirmationToken } from "./tokenStore";
import {
  ATTEMPT_HEADER,
  DEAD_LETTER_QUEUE,
  MAX_ATTEMPTS,
  attemptOf,
  retryQueueName,
} from "./topology";

export type ConfirmationEvent = {
  userId: string;
  email: string;
  requestedAt?: string;
};

export type ConsumerDeps = {
  channel: ConfirmChannel;
  prisma: PrismaClient;
  mailer: Mailer;
  storefrontUrl: string;
};

const parseEvent = (message: ConsumeMessage): ConfirmationEvent | undefined => {
  try {
    const parsed = JSON.parse(message.content.toString("utf8")) as Partial<
      Record<keyof ConfirmationEvent, unknown>
    >;

    if (typeof parsed.userId !== "string" || !parsed.userId) {
      return undefined;
    }

    if (typeof parsed.email !== "string" || !parsed.email) {
      return undefined;
    }

    return {
      userId: parsed.userId,
      email: parsed.email,
      requestedAt:
        typeof parsed.requestedAt === "string" ? parsed.requestedAt : undefined,
    };
  } catch {
    return undefined;
  }
};

export type ConfirmationHandler = (message: ConsumeMessage | null) => Promise<void>;

/**
 * One delivery of one account confirmation event. The letter is minted and
 * sent on every attempt, because the raw token exists only in memory and in
 * the letter: a retry therefore replaces the previous link, which is the cost
 * the spec records for never storing a live secret in a queue.
 */
export const createConfirmationHandler = (
  deps: ConsumerDeps,
): ConfirmationHandler => {
  const { channel, prisma, mailer, storefrontUrl } = deps;

  const drop = (message: ConsumeMessage, reason: string, fields = {}) => {
    channel.ack(message);
    logger.warn({ event: "email.skipped", reason, ...fields });
  };

  const fail = async (
    message: ConsumeMessage,
    attempt: number,
    error: unknown,
  ): Promise<void> => {
    const reason = describeError(error);

    logger.error({ event: "email.send.failed", attempt, reason });

    // The retry names the attempt that comes next, so a redelivery steps one
    // waiting queue further; the dead letter keeps the number that failed.
    const headers = {
      ...(message.properties.headers ?? {}),
      [ATTEMPT_HEADER]: attempt < MAX_ATTEMPTS ? attempt + 1 : attempt,
    };

    try {
      if (attempt < MAX_ATTEMPTS) {
        channel.sendToQueue(retryQueueName(attempt), message.content, {
          persistent: true,
          headers,
        });
        await channel.waitForConfirms();
      } else {
        channel.sendToQueue(DEAD_LETTER_QUEUE, message.content, {
          persistent: true,
          headers: { ...headers, "x-last-error": reason },
        });
        await channel.waitForConfirms();
        logger.error({ event: "email.dead_lettered", attempt, reason });
      }

      channel.ack(message);
    } catch (publishError) {
      logger.error({
        event: "email.retry.publish.failed",
        attempt,
        reason: describeError(publishError),
      });
      channel.nack(message, false, true);
    }
  };

  return async (message) => {
    if (!message) {
      return;
    }

    const attempt = attemptOf(message.properties.headers);
    const event = parseEvent(message);

    if (!event) {
      drop(message, "invalid_body");
      return;
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: event.userId },
        select: { email: true },
      });

      if (!user) {
        drop(message, "user_missing", { userId: event.userId });
        return;
      }

      if (user.email !== event.email) {
        drop(message, "email_changed", { userId: event.userId });
        return;
      }

      const { rawToken } = await mintConfirmationToken(prisma, {
        userId: event.userId,
        email: event.email,
      });

      const letter = buildConfirmationLetter(
        confirmationLink(storefrontUrl, rawToken),
      );

      await mailer.send(event.email, letter);

      channel.ack(message);
      logger.info({
        event: "email.sent",
        userId: event.userId,
        attempt,
      });
    } catch (error) {
      await fail(message, attempt, error);
    }
  };
};
