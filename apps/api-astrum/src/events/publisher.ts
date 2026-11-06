import { connect, type ChannelModel, type ConfirmChannel } from "amqplib";
import { logger } from "../common/helpers/logger";
import { describeError } from "./describe-error";
import {
  CONFIRMATION_ROUTING_KEY,
  EVENTS_EXCHANGE,
  PUBLISH_TIMEOUT_MS,
} from "./events.constants";
import { DEFAULT_LETTER_LOCALE, type LetterLocale } from "./locale";

let connection: ChannelModel | undefined;
let channel: ConfirmChannel | undefined;
let opening: Promise<ConfirmChannel> | undefined;

const withTimeout = async <T>(
  work: Promise<T>,
  timeoutMs: number,
): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(new Error(`the broker did not answer within ${timeoutMs} ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

const open = async (): Promise<ConfirmChannel> => {
  const url = process.env.RABBITMQ_URL;

  if (!url) {
    throw new Error("RABBITMQ_URL is required to publish events");
  }

  const opened = await connect(url);
  const confirmed = await opened.createConfirmChannel();

  opened.on("error", (error: Error) => {
    logger.error({ event: "rabbit.connection.error", reason: describeError(error) });
  });

  opened.on("close", () => {
    connection = undefined;
    channel = undefined;
  });

  await confirmed.assertExchange(EVENTS_EXCHANGE, "direct", { durable: true });

  connection = opened;
  channel = confirmed;

  return confirmed;
};

const channelOrOpen = async (): Promise<ConfirmChannel> => {
  if (channel) {
    return channel;
  }

  opening ??= open().finally(() => {
    opening = undefined;
  });

  return await opening;
};

const reset = async (): Promise<void> => {
  const confirmed = channel;
  const opened = connection;

  channel = undefined;
  connection = undefined;

  try {
    await confirmed?.close();
  } catch (error) {
    logger.warn({
      event: "rabbit.channel.close.failed",
      reason: describeError(error),
    });
  }

  try {
    await opened?.close();
  } catch (error) {
    logger.warn({
      event: "rabbit.connection.close.failed",
      reason: describeError(error),
    });
  }
};

/**
 * Fire and forget with a bound: the profile change is already committed, so a
 * broker that is down is one log line and the resend button, never a request
 * that hangs on a socket.
 */
export const publishConfirmationRequested = async ({
  userId,
  email,
  locale = DEFAULT_LETTER_LOCALE,
}: {
  userId: string;
  email: string;
  locale?: LetterLocale;
}): Promise<void> => {
  try {
    await withTimeout(
      (async () => {
        const confirmed = await channelOrOpen();

        confirmed.publish(
          EVENTS_EXCHANGE,
          CONFIRMATION_ROUTING_KEY,
          Buffer.from(
            JSON.stringify({
              userId,
              email,
              requestedAt: new Date().toISOString(),
              locale,
            }),
          ),
          { persistent: true, contentType: "application/json" },
        );

        await confirmed.waitForConfirms();
      })(),
      PUBLISH_TIMEOUT_MS,
    );
  } catch (error) {
    await reset();
    logger.error({
      event: "email.publish.failed",
      userId,
      reason: describeError(error),
    });
  }
};
