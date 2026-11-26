import { describeError } from "../common/helpers/describeError";
import { logger } from "../common/helpers/logger";
import { withTimeout } from "../common/helpers/timeout";
import {
  CONFIRMATION_ROUTING_KEY,
  EVENTS_EXCHANGE,
  PERSISTENT_JSON_PUBLISH_OPTIONS,
  PUBLISH_TIMEOUT_MS,
} from "./constants/events.constants";
import {
  channelOrOpen,
  resetConnection,
} from "./helpers/rabbit-connection.helpers";
import { DEFAULT_LETTER_LOCALE, type LetterLocale } from "./locale";

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
          PERSISTENT_JSON_PUBLISH_OPTIONS,
        );

        await confirmed.waitForConfirms();
      })(),
      PUBLISH_TIMEOUT_MS,
      `the broker did not answer within ${PUBLISH_TIMEOUT_MS} ms`,
    );
  } catch (error) {
    await resetConnection();
    logger.error({
      event: "email.publish.failed",
      userId,
      reason: describeError(error),
    });
  }
};
