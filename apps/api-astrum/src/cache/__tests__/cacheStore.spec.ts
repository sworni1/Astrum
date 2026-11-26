import { createCacheStore, isCacheEnabled } from "../cacheStore";
import { CACHE_CLIENT_OPTIONS } from "../constants/cacheStore.constants";
import type { CacheClientSurface } from "../types/cache.types";

type Pipeline = {
  incr: jest.Mock;
  exec: jest.Mock;
};

const fakeClient = () => {
  const pipeline: Pipeline = {
    incr: jest.fn(),
    exec: jest.fn().mockResolvedValue([]),
  };
  pipeline.incr.mockReturnValue(pipeline);

  const client = {
    get: jest.fn().mockResolvedValue("payload"),
    set: jest.fn().mockResolvedValue("OK"),
    del: jest.fn().mockResolvedValue(1),
    pipeline: jest.fn().mockReturnValue(pipeline),
    on: jest.fn(),
    quit: jest.fn().mockResolvedValue("OK"),
  };

  return { client, pipeline };
};

const storeOf = (client: ReturnType<typeof fakeClient>["client"]) =>
  createCacheStore(
    "redis://localhost:6379",
    () => client as unknown as CacheClientSurface,
  );

describe("CACHE_CLIENT_OPTIONS", () => {
  it("bounds every command and every connect at a tenth of a second (AC-9)", () => {
    expect(CACHE_CLIENT_OPTIONS.commandTimeout).toBe(100);
    expect(CACHE_CLIENT_OPTIONS.connectTimeout).toBe(100);
    expect(CACHE_CLIENT_OPTIONS.enableOfflineQueue).toBe(false);
    expect(CACHE_CLIENT_OPTIONS.maxRetriesPerRequest).toBe(1);
    expect(CACHE_CLIENT_OPTIONS.lazyConnect).toBe(true);
  });

  it("caps the reconnect wait at two seconds (AC-1)", () => {
    const strategy = CACHE_CLIENT_OPTIONS.retryStrategy as (
      attempt: number,
    ) => number;

    expect(strategy(1)).toBe(200);
    expect(strategy(100)).toBe(2_000);
  });
});

describe("createCacheStore", () => {
  it("builds the client with the bounded options and one error listener (AC-1)", () => {
    const { client } = fakeClient();
    const factory = jest.fn(() => client as unknown as CacheClientSurface);

    createCacheStore("redis://cache:6379", factory);

    expect(factory).toHaveBeenCalledWith(
      "redis://cache:6379",
      CACHE_CLIENT_OPTIONS,
    );
    expect(client.on).toHaveBeenCalledWith("error", expect.any(Function));
  });

  it("writes one warn line when the connection reports an error (AC-1)", () => {
    const { client } = fakeClient();
    const warn = jest
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    storeOf(client);
    const listener = client.on.mock.calls[0][1] as (error: Error) => void;
    listener(new Error("connection refused"));

    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(warn.mock.calls[0][0]))).toMatchObject({
      level: "warn",
      event: "cache.connection",
      reason: "connection refused",
    });

    warn.mockRestore();
  });

  it("sets a payload with a lifetime and increments a batch in one pipeline (AC-1, AC-10)", async () => {
    const { client, pipeline } = fakeClient();
    const store = storeOf(client);

    await store.setWithTtl("cache:v1:shipping", "{}", 31);
    await store.incrementAll([
      "cache:meta:epoch:lists",
      "cache:meta:ver:product:p1",
    ]);
    await store.get("cache:v1:shipping");
    await store.remove("cache:v1:shipping");

    expect(client.set).toHaveBeenCalledWith(
      "cache:v1:shipping",
      "{}",
      "EX",
      31,
    );
    expect(pipeline.incr).toHaveBeenNthCalledWith(1, "cache:meta:epoch:lists");
    expect(pipeline.incr).toHaveBeenNthCalledWith(
      2,
      "cache:meta:ver:product:p1",
    );
    expect(pipeline.exec).toHaveBeenCalledTimes(1);
    expect(client.get).toHaveBeenCalledWith("cache:v1:shipping");
    expect(client.del).toHaveBeenCalledWith("cache:v1:shipping");
  });

  it("rejects at the budget instead of waiting on a store that never answers (AC-9)", async () => {
    const client = fakeClient().client;
    client.get.mockReturnValue(new Promise<never>(() => undefined));
    const store = storeOf(client);

    await expect(store.get("cache:v1:shipping")).rejects.toThrow(
      "cache command over budget",
    );
  });

  it("surfaces a counter bump the pipeline reported as failed (AC-8)", async () => {
    const { client, pipeline } = fakeClient();
    pipeline.exec.mockResolvedValue([
      [null, 1],
      [
        new Error("READONLY You can't write against a read only replica."),
        null,
      ],
    ]);
    const store = storeOf(client);

    await expect(
      store.incrementAll([
        "cache:meta:epoch:lists",
        "cache:meta:ver:product:p1",
      ]),
    ).rejects.toThrow("READONLY");
  });
});

describe("isCacheEnabled", () => {
  it("turns the cache off only for the exact false (AC-1)", () => {
    expect(
      isCacheEnabled({ CACHE_ENABLED: "false" } as NodeJS.ProcessEnv),
    ).toBe(false);
    expect(isCacheEnabled({ CACHE_ENABLED: "true" } as NodeJS.ProcessEnv)).toBe(
      true,
    );
    expect(isCacheEnabled({} as NodeJS.ProcessEnv)).toBe(true);
  });
});
