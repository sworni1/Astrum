import Redis from "ioredis";

import { logger } from "../common/helpers/logger";
import { SESSION_CLIENT_OPTIONS } from "./constants/session.constants";
import type { SessionStore } from "./types/session.types";

export type { SessionRecord, SessionStore } from "./types/session.types";

export const createSessionStore = (url: string | undefined): SessionStore => {
  if (!url) {
    throw new Error(
      "REDIS_URL is required: the session store has no default connection string",
    );
  }

  const client = new Redis(url, SESSION_CLIENT_OPTIONS);

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
