import assert from "node:assert/strict";
import { test } from "node:test";
import { buildConfirmationLetter, resolveLetterLocale } from "./letter";
import { enCopy } from "./letters/en";
import { ruCopy } from "./letters/ru";

const LINK = "https://shop.example/api-gateway/auth/confirm?token=abc";

test("AC-9: a letter without a language is English and carries both parts", () => {
  const letter = buildConfirmationLetter(LINK);

  assert.equal(letter.subject, enCopy.subject);
  assert.match(letter.subject, /Confirm/);
  assert.ok(letter.text.length > 0);
  assert.ok(letter.html.startsWith("<div"));
});

test("AC-9: the Russian language keeps the Russian subject", () => {
  const letter = buildConfirmationLetter(LINK, "ru");

  assert.equal(letter.subject, ruCopy.subject);
  assert.ok(letter.text.includes(ruCopy.intro));
});

test("AC-10: an unknown language falls back to English", () => {
  assert.equal(resolveLetterLocale("de"), "en");
  assert.equal(resolveLetterLocale(undefined), "en");
  assert.equal(resolveLetterLocale("ru"), "ru");

  const letter = buildConfirmationLetter(LINK, resolveLetterLocale("de"));

  assert.equal(letter.subject, enCopy.subject);
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
