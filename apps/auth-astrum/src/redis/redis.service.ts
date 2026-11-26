import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";
import {
  INCREMENT_WITH_TTL_SCRIPT,
  REDIS_CLIENT_OPTIONS,
  REDIS_URL_VARIABLE,
} from "./constants/redis.constants";

export type SessionStore = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<unknown>;
  del(key: string): Promise<number>;
  ping(): Promise<string>;
};

@Injectable()
export class RedisService implements SessionStore, OnModuleDestroy {
  private readonly client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor() {
    const url = process.env[REDIS_URL_VARIABLE];

    if (!url) {
      throw new Error(
        "REDIS_URL is required: the session store has no default connection string",
      );
    }

    this.client = new Redis(url, REDIS_CLIENT_OPTIONS);

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
