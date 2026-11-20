import { logger } from "../common/helpers/logger";
import { loggedSid, type SessionStore, sessionKey } from "./sessionStore";

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const revokeSession = async (
  store: SessionStore,
  sid: string | undefined,
): Promise<void> => {
  if (!sid) {
    return;
  }

  try {
    const removed = await store.del(sessionKey(sid));

    if (removed > 0) {
      logger.info({ event: "session.revoked", sid: loggedSid(sid) });
    }
  } catch (error) {
    logger.error({
      event: "session.revoke.failed",
      sid: loggedSid(sid),
      reason: describeError(error),
    });
  }
};
