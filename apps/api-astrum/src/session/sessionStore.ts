import Redis from "ioredis";

import { logger } from "../common/helpers/logger";

/** One day, the same lifetime the signed token carries. */
export const SESSION_TTL_SECONDS = 86_400;

const SESSION_KEY_PREFIX = "session:";
const LOGGED_SID_LENGTH = 8;

export type SessionRecord = {
  userId: string;
  createdAt: string;
  userAgent: string | null;
};

/**
 * The four commands the session path needs. The gateway, the auth service and
 * their tests all talk through this shape, so a test can pass a fake in memory
 * instead of reaching for a container.
 */
export type SessionStore = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<unknown>;
  del(key: string): Promise<number>;
  ping(): Promise<string>;
};

export const sessionKey = (sid: string): string =>
  `${SESSION_KEY_PREFIX}${sid}`;

/** A sid is a bearer handle: log lines carry its first characters, never all of it. */
export const loggedSid = (sid: string): string =>
  sid.slice(0, LOGGED_SID_LENGTH);

/**
 * One client per process: a connection per request would turn a busy shop into
 * a Redis connection storm. The offline queue stays off, so a dead store fails
 * the command immediately instead of buffering it behind a reconnect.
 */
export const createSessionStore = (url: string | undefined): SessionStore => {
  if (!url) {
    throw new Error(
      "REDIS_URL is required: the session store has no default connection string",
    );
  }

  const client = new Redis(url, {
    commandTimeout: 1000,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
  });

  // Without a listener ioredis prints its own unformatted lines; a connection
  // that keeps failing is worth one structured line instead.
  client.on("error", (error: Error) => {
    logger.error({ event: "session.store.connection", reason: error.message });
  });

  return {
    get: async (key) => await client.get(key),
    set: async (key, value, ttlSeconds) =>
      await client.set(key, value, "EX", ttlSeconds),
    del: async (key) => await client.del(key),
    ping: async () => await client.ping(),
  };
};

let store: SessionStore | undefined;

export const getSessionStore = (): SessionStore => {
  store ??= createSessionStore(process.env.REDIS_URL);
  return store;
};
