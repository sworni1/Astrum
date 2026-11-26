import type Redis from "ioredis";

export type CacheStore = {
  get(key: string): Promise<string | null>;
  setWithTtl(key: string, value: string, ttlSeconds: number): Promise<unknown>;
  incrementAll(keys: readonly string[]): Promise<unknown>;
  remove(key: string): Promise<unknown>;
  quit(): Promise<unknown>;
};

type CacheClient = Pick<
  Redis,
  "get" | "set" | "del" | "pipeline" | "on" | "quit"
>;

export type CacheClientSurface = CacheClient;
