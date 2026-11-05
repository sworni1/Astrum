import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMailer } from "./mailer";

test("AC-17: without SMTP_URL the letter is written under the outbox directory", async () => {
  const outbox = await mkdtemp(join(tmpdir(), "astrum-outbox-"));

  try {
    const mailer = createMailer(undefined, "no-reply@astrum.local", outbox);

    assert.equal(mailer.kind, "outbox");

    await mailer.send("customer@example.test", {
      subject: "Подтвердите адрес почты в Astrum",
      text: "https://shop.example/api-gateway/auth/confirm?token=raw",
      html: "<p>https://shop.example/api-gateway/auth/confirm?token=raw</p>",
    });

    const files = await readdir(outbox);

    assert.equal(files.length, 1);

    const letter = await readFile(join(outbox, files[0]), "utf8");

    assert.match(letter, /^From: no-reply@astrum\.local\r?\n/);
    assert.match(letter, /^To: customer@example\.test$/m);
    assert.match(letter, /token=raw/);
  } finally {
    await rm(outbox, { recursive: true, force: true });
  }
});
