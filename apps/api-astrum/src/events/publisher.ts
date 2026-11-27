import { describeError } from "../common/helpers/describeError";
import { logger } from "../common/helpers/logger";
import { sleep } from "../common/helpers/time";
import { withTimeout } from "../common/helpers/timeout";
import {
  CONFIRMATION_ROUTING_KEY,
  EVENTS_EXCHANGE,
  PERSISTENT_JSON_PUBLISH_OPTIONS,
  PUBLISH_ATTEMPTS,
  PUBLISH_RETRY_DELAY_MS,
  PUBLISH_TIMEOUT_MS,
} from "./constants/events.constants";
import {
  channelOrOpen,
  resetConnection,
} from "./helpers/rabbit-connection.helpers";
import { DEFAULT_LETTER_LOCALE, type LetterLocale } from "./locale";

type ConfirmationInput = {
  userId: string;
  email: string;
  locale?: LetterLocale;
};

const publishOnce = async ({
  userId,
  email,
  locale,
}: ConfirmationInput): Promise<void> =>
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
        PERSISTENT_JSON_PUBLISH_OPTIONS,
      );

      await confirmed.waitForConfirms();
    })(),
    PUBLISH_TIMEOUT_MS,
    `the broker did not answer within ${PUBLISH_TIMEOUT_MS} ms`,
  );

export const publishConfirmationRequested = async ({
  locale = DEFAULT_LETTER_LOCALE,
  ...input
}: ConfirmationInput): Promise<void> => {
  for (let attempt = 1; attempt <= PUBLISH_ATTEMPTS; attempt += 1) {
    try {
      await publishOnce({ ...input, locale });
      return;
    } catch (error) {
      await resetConnection();

      const lastAttempt = attempt === PUBLISH_ATTEMPTS;

      logger[lastAttempt ? "error" : "warn"]({
        event: lastAttempt ? "email.publish.failed" : "email.publish.retrying",
        userId: input.userId,
        attempt,
        reason: describeError(error),
      });

      if (!lastAttempt) {
        await sleep(PUBLISH_RETRY_DELAY_MS * attempt);
      }
    }
  }
};
