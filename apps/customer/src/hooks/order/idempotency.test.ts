import { describe, expect, it } from "vitest";
import { createIdempotencyKey, isTerminalAnswer } from "./idempotency";

const axiosError = (status?: number) => ({
  isAxiosError: true,
  response: status === undefined ? undefined : { status },
});

describe("createIdempotencyKey", () => {
  it("даёт 32 шестнадцатеричных знака", () => {
    expect(createIdempotencyKey()).toMatch(/^[0-9a-f]{32}$/);
  });

  it("даёт разный ключ на каждый вызов", () => {
    expect(createIdempotencyKey()).not.toBe(createIdempotencyKey());
  });
});

describe("isTerminalAnswer", () => {
  it("считает окончательными 409 и 422", () => {
    expect(isTerminalAnswer(axiosError(409))).toBe(true);
    expect(isTerminalAnswer(axiosError(422))).toBe(true);
  });

  it("не считает окончательным 5xx, чтобы повтор шёл с тем же ключом", () => {
    expect(isTerminalAnswer(axiosError(500))).toBe(false);
    expect(isTerminalAnswer(axiosError(503))).toBe(false);
  });

  it("не считает окончательным таймаут без ответа и обычную ошибку", () => {
    expect(isTerminalAnswer(axiosError(undefined))).toBe(false);
    expect(isTerminalAnswer(new Error("Network Error"))).toBe(false);
  });
});
