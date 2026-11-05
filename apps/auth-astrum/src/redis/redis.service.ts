import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

/** One day, the same lifetime the signed token carries. */
export const SESSION_TTL_SECONDS = 86_400;

const SESSION_KEY_PREFIX = "session:";

const INCREMENT_WITH_TTL_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
return count
`;
const LOGGED_SID_LENGTH = 8;

/**
 * The four commands the session path needs, so a test can pass a fake in memory
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

/** A sid is a bearer handle: log lines carry its first characters, never all. */
export const loggedSid = (sid: string): string =>
  sid.slice(0, LOGGED_SID_LENGTH);

/**
 * One client per process. The offline queue stays off, so a dead store fails a
 * command immediately instead of buffering it behind a reconnect, and the
 * command timeout keeps a health probe from hanging.
 */
@Injectable()
export class RedisService implements SessionStore, OnModuleDestroy {
  private readonly client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor() {
    const url = process.env.REDIS_URL;

    if (!url) {
      throw new Error(
        "REDIS_URL is required: the session store has no default connection string",
      );
    }

    this.client = new Redis(url, {
      commandTimeout: 1000,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });

    // Without a listener ioredis prints its own unformatted lines; a connection
    // that keeps failing is worth one structured line instead.
    this.client.on("error", (error: Error) => {
      this.logger.error(
        JSON.stringify({
          event: "session.store.connection",
          reason: error.message,
        }),
      );
    });
  }

  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<unknown> {
    return await this.client.set(key, value, "EX", ttlSeconds);
  }

  async del(key: string): Promise<number> {
    return await this.client.del(key);
  }

  /**
   * One script per key, so `INCR` and `EXPIRE` cannot be separated by a crash:
   * a counter without a lifetime would block an address forever.
   */
  async incrementWithTtl(key: string, ttlSeconds: number): Promise<number> {
    const count = await this.client.eval(
      INCREMENT_WITH_TTL_SCRIPT,
      1,
      key,
      String(ttlSeconds),
    );

    return Number(count);
  }

  async ping(): Promise<string> {
    return await this.client.ping();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
