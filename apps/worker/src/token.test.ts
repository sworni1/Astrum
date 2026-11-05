import assert from "node:assert/strict";
import { test } from "node:test";
import {
  TOKEN_TTL_SECONDS,
  confirmationLink,
  expiresAtFrom,
  hashToken,
  mintRawToken,
} from "./token";

test("AC-5: raw token is 32 random bytes in base64url", () => {
  const first = mintRawToken();
  const second = mintRawToken();

  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, second);
});

test("AC-5: only the sha256 hex of the token is stored", () => {
  const raw = mintRawToken();
  const hash = hashToken(raw);

  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(hash, hashToken(raw));
  assert.notEqual(hash, hashToken(`${raw}x`));
  assert.ok(!hash.includes(raw));
});

test("AC-5: the token lives 24 hours from mint time", () => {
  const mintedAt = new Date("2026-11-05T10:00:00.000Z");
  const expiresAt = expiresAtFrom(mintedAt);

  assert.equal(expiresAt.getTime() - mintedAt.getTime(), TOKEN_TTL_SECONDS * 1000);
});

test("AC-6: the link points at the storefront confirm route", () => {
  const link = confirmationLink("https://shop.example", "raw-token");

  assert.equal(
    link,
    "https://shop.example/api-gateway/auth/confirm?token=raw-token",
  );
});
