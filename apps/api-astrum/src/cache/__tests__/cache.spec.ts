jest.mock("../cacheStore", () => ({
  getCacheStore: jest.fn(),
}));

import { logger } from "../../common/helpers/logger";
import {
  DEFAULT_LIST_TTL_SECONDS,
  DEFAULT_PRODUCT_TTL_SECONDS,
  getOrSet,
  invalidateLists,
  invalidateProducts,
  invalidateReviews,
  invalidateShipping,
  listTtlSeconds,
  productTtlSeconds,
  readVersion,
} from "../cache";
import { getCacheStore } from "../cacheStore";

const storeMock = getCacheStore as jest.Mock;

const fakeStore = () => ({
  get: jest.fn().mockResolvedValue(null),
  setWithTtl: jest.fn().mockResolvedValue("OK"),
  incrementAll: jest.fn().mockResolvedValue([]),
  remove: jest.fn().mockResolvedValue(1),
  quit: jest.fn().mockResolvedValue("OK"),
});

const readLines = (info: jest.SpyInstance) =>
  info.mock.calls
    .map(([fields]) => fields as Record<string, unknown>)
    .filter((fields) => fields.event === "cache.read");

const warnLines = (warn: jest.SpyInstance, event: string) =>
  warn.mock.calls
    .map(([fields]) => fields as Record<string, unknown>)
    .filter((fields) => fields.event === event);

describe("getOrSet", () => {
  let info: jest.SpyInstance;

  beforeEach(() => {
    info = jest.spyOn(logger, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    info.mockRestore();
  });

  it("answers from the database on a miss, stores the payload with its lifetime, and logs one line (AC-11)", async () => {
    const store = fakeStore();
    storeMock.mockReturnValue(store);

    const value = await getOrSet({
      key: "cache:v1:shipping",
      ttlSeconds: 31,
      load: async () => ({ methods: [{ id: "sm-1", price: 299 }] }),
    });

    expect(value).toEqual({ methods: [{ id: "sm-1", price: 299 }] });
    expect(store.setWithTtl).toHaveBeenCalledWith(
      "cache:v1:shipping",
      JSON.stringify({ methods: [{ id: "sm-1", price: 299 }] }),
      31,
    );
    expect(readLines(info)).toEqual([
      expect.objectContaining({
        event: "cache.read",
        key: "cache:v1:shipping",
        hit: false,
      }),
    ]);
  });

  it("answers a hit without touching the database and names the epoch key (AC-2, AC-11)", async () => {
    const store = fakeStore();
    store.get.mockResolvedValue('{"products":[{"id":"p1"}]}');
    storeMock.mockReturnValue(store);
    const load = jest.fn();

    const value = await getOrSet({
      key: "cache:v1:lists:3:recs:abc",
      ttlSeconds: 30,
      epochKey: "cache:meta:epoch:lists",
      load,
    });

    expect(value).toEqual({ products: [{ id: "p1" }] });
    expect(load).not.toHaveBeenCalled();
    expect(readLines(info)).toEqual([
      expect.objectContaining({
        hit: true,
        key: "cache:v1:lists:3:recs:abc",
        epochKey: "cache:meta:epoch:lists",
        ms: expect.any(Number),
      }),
    ]);
  });

  it("reads a stored payload as a miss when it is not valid JSON (AC-2)", async () => {
    const store = fakeStore();
    store.get.mockResolvedValue("not json");
    storeMock.mockReturnValue(store);

    const value = await getOrSet({
      key: "cache:v1:product:p1:v0",
      ttlSeconds: 60,
      load: async () => ({ id: "p1" }),
    });

    expect(value).toEqual({ id: "p1" });
    expect(readLines(info)[0]).toMatchObject({ hit: false });
  });

  it("caches no answer when the loader refuses, so a missing row never becomes a cached absence (AC-2)", async () => {
    const store = fakeStore();
    storeMock.mockReturnValue(store);

    await expect(
      getOrSet({
        key: "cache:v1:product:missing:v0",
        ttlSeconds: 60,
        load: async () => {
          throw new Error("Product not found");
        },
      }),
    ).rejects.toThrow("Product not found");

    expect(store.setWithTtl).not.toHaveBeenCalled();
  });

  it("falls back to the database when the cache read fails, and still logs the read (AC-8)", async () => {
    const store = fakeStore();
    store.get.mockRejectedValue(new Error("connection refused"));
    storeMock.mockReturnValue(store);
    const warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined);

    const value = await getOrSet({
      key: "cache:v1:shipping",
      ttlSeconds: 30,
      load: async () => ({ methods: [] }),
    });

    expect(value).toEqual({ methods: [] });
    expect(warnLines(warn, "cache.error")).toHaveLength(1);
    expect(readLines(info)[0]).toMatchObject({ hit: false });

    warn.mockRestore();
  });

  it("answers the request when the write fails (AC-8)", async () => {
    const store = fakeStore();
    store.setWithTtl.mockRejectedValue(new Error("over budget"));
    storeMock.mockReturnValue(store);
    const warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined);

    const value = await getOrSet({
      key: "cache:v1:shipping",
      ttlSeconds: 30,
      load: async () => ({ methods: [{ id: "sm-1" }] }),
    });

    expect(value).toEqual({ methods: [{ id: "sm-1" }] });
    expect(warnLines(warn, "cache.error")).toHaveLength(1);

    warn.mockRestore();
  });

  it("uses no client and logs no read when the cache is switched off (AC-1)", async () => {
    storeMock.mockReturnValue(null);
    const load = jest.fn().mockResolvedValue({ methods: [] });

    await getOrSet({ key: "cache:v1:shipping", ttlSeconds: 30, load });

    expect(load).toHaveBeenCalledTimes(1);
    expect(readLines(info)).toHaveLength(0);
  });
});

describe("readVersion", () => {
  it("answers the counter, and zero when the key was never written (AC-2, AC-5)", async () => {
    const store = fakeStore();
    storeMock.mockReturnValue(store);

    store.get.mockResolvedValue("3");
    expect(await readVersion("cache:meta:ver:product:p1")).toBe(3);

    store.get.mockResolvedValue(null);
    expect(await readVersion("cache:meta:ver:product:p1")).toBe(0);

    store.get.mockResolvedValue("not a number");
    expect(await readVersion("cache:meta:ver:product:p1")).toBe(0);
  });

  it("answers zero when the cache is off or the read fails (AC-8)", async () => {
    storeMock.mockReturnValue(null);
    expect(await readVersion("cache:meta:epoch:lists")).toBe(0);

    const store = fakeStore();
    store.get.mockRejectedValue(new Error("over budget"));
    storeMock.mockReturnValue(store);

    const warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined);
    expect(await readVersion("cache:meta:epoch:lists")).toBe(0);
    expect(warnLines(warn, "cache.error")).toHaveLength(1);
    warn.mockRestore();
  });
});

describe("invalidation", () => {
  it("bumps the epoch and one version per distinct product in one batch (AC-7 a, b)", async () => {
    const store = fakeStore();
    storeMock.mockReturnValue(store);

    await invalidateProducts(["p1", "p1", "p2"]);

    expect(store.incrementAll).toHaveBeenCalledWith([
      "cache:meta:epoch:lists",
      "cache:meta:ver:product:p1",
      "cache:meta:ver:product:p2",
    ]);
  });

  it("bumps the list epoch on its own for a new product (AC-7 e)", async () => {
    const store = fakeStore();
    storeMock.mockReturnValue(store);

    await invalidateLists();

    expect(store.incrementAll).toHaveBeenCalledWith(["cache:meta:epoch:lists"]);
  });

  it("bumps one product's review version for a like or a comment (AC-7 d)", async () => {
    const store = fakeStore();
    storeMock.mockReturnValue(store);

    await invalidateReviews("p1");

    expect(store.incrementAll).toHaveBeenCalledWith([
      "cache:meta:ver:reviews:p1",
    ]);
  });

  it("removes the shipping key, which has no counter (AC-6)", async () => {
    const store = fakeStore();
    storeMock.mockReturnValue(store);

    await invalidateShipping();

    expect(store.remove).toHaveBeenCalledWith("cache:v1:shipping");
  });

  it("logs one warning and never throws when the invalidation fails (AC-8)", async () => {
    const store = fakeStore();
    store.incrementAll.mockRejectedValue(new Error("connection refused"));
    storeMock.mockReturnValue(store);
    const warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined);

    await expect(invalidateLists()).resolves.toBeUndefined();

    expect(warnLines(warn, "cache.invalidate.error")).toHaveLength(1);
    warn.mockRestore();
  });
});

describe("lifetimes", () => {
  afterEach(() => {
    delete process.env.CACHE_LIST_TTL_SECONDS;
    delete process.env.CACHE_PRODUCT_TTL_SECONDS;
  });

  it("draws the list lifetime from 30 through 33 seconds (AC-6, AC-10)", () => {
    for (let draw = 0; draw < 50; draw += 1) {
      const ttl = listTtlSeconds();

      expect(ttl).toBeGreaterThanOrEqual(DEFAULT_LIST_TTL_SECONDS);
      expect(ttl).toBeLessThan(DEFAULT_LIST_TTL_SECONDS + 4);
    }
  });

  it("draws the product lifetime from 60 through 66 seconds (AC-2, AC-5)", () => {
    for (let draw = 0; draw < 50; draw += 1) {
      const ttl = productTtlSeconds();

      expect(ttl).toBeGreaterThanOrEqual(DEFAULT_PRODUCT_TTL_SECONDS);
      expect(ttl).toBeLessThan(DEFAULT_PRODUCT_TTL_SECONDS + 7);
    }
  });

  it("takes the base from the environment and falls back on a bad value (AC-13)", () => {
    process.env.CACHE_LIST_TTL_SECONDS = "10";
    process.env.CACHE_PRODUCT_TTL_SECONDS = "20";

    expect(listTtlSeconds()).toBeGreaterThanOrEqual(10);
    expect(listTtlSeconds()).toBeLessThan(14);
    expect(productTtlSeconds()).toBeGreaterThanOrEqual(20);
    expect(productTtlSeconds()).toBeLessThan(27);

    process.env.CACHE_PRODUCT_TTL_SECONDS = "not a number";
    expect(productTtlSeconds()).toBeGreaterThanOrEqual(
      DEFAULT_PRODUCT_TTL_SECONDS,
    );
  });
});
