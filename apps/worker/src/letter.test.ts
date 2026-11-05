import assert from "node:assert/strict";
import { test } from "node:test";
import { CONFIRMATION_SUBJECT, buildConfirmationLetter } from "./letter";

const LINK = "https://shop.example/api-gateway/auth/confirm?token=abc";

test("AC-6: the letter carries a Russian subject and both parts", () => {
  const letter = buildConfirmationLetter(LINK);

  assert.equal(letter.subject, CONFIRMATION_SUBJECT);
  assert.match(letter.subject, /Подтвердите/);
  assert.ok(letter.text.length > 0);
  assert.ok(letter.html.startsWith("<div"));
});

test("AC-6: exactly one link, the same in both parts", () => {
  const letter = buildConfirmationLetter(LINK);

  assert.equal(letter.text.split(LINK).length - 1, 1);
  assert.equal(letter.html.split(LINK).length - 1, 2);
  assert.match(letter.html, /<a href="https:\/\/shop\.example/);
});

test("AC-6: an address with markup characters is escaped in the html part", () => {
  const letter = buildConfirmationLetter('https://shop.example/?a=1&b="2"');

  assert.ok(letter.html.includes("&amp;"));
  assert.ok(letter.html.includes("&quot;"));
  assert.ok(!letter.html.includes('href="https://shop.example/?a=1&b="'));
});
