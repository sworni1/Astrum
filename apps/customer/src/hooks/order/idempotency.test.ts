import { describe, expect, it } from "vitest";
import { createIdempotencyKey, isTerminalAnswer } from "./idempotency";

const axiosError = (status?: number) => ({
  isAxiosError: true,
  response: status === undefined ? undefined : { status },
});

describe("createIdempotencyKey", () => {
  it("returns 32 hexadecimal characters", () => {
    expect(createIdempotencyKey()).toMatch(/^[0-9a-f]{32}$/);
  });

  it("returns a different key on every call", () => {
    expect(createIdempotencyKey()).not.toBe(createIdempotencyKey());
  });
});

describe("isTerminalAnswer", () => {
  it("treats 409 and 422 as final", () => {
    expect(isTerminalAnswer(axiosError(409))).toBe(true);
    expect(isTerminalAnswer(axiosError(422))).toBe(true);
  });

  it("does not treat 5xx as final, so a retry keeps the same key", () => {
    expect(isTerminalAnswer(axiosError(500))).toBe(false);
    expect(isTerminalAnswer(axiosError(503))).toBe(false);
  });

  it("does not treat a timeout without an answer or a plain error as final", () => {
    expect(isTerminalAnswer(axiosError(undefined))).toBe(false);
    expect(isTerminalAnswer(new Error("Network Error"))).toBe(false);
  });
});
