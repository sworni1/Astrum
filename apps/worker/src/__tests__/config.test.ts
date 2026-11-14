import assert from "node:assert/strict";
import { test } from "node:test";
import { loadConfig } from "../config";

const baseEnv = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  RABBITMQ_URL: "amqp://localhost:5672",
  MAIL_FROM: "no-reply@astrum.local",
  STOREFRONT_URL: "http://localhost:3000/",
};

test("AC-17: the worker refuses to boot without RABBITMQ_URL", () => {
  const { RABBITMQ_URL: _omitted, ...env } = baseEnv;

  assert.throws(() => loadConfig({ ...env }), /RABBITMQ_URL is required/);
});

test("AC-17: the worker refuses to boot without MAIL_FROM", () => {
  const { MAIL_FROM: _omitted, ...env } = baseEnv;

  assert.throws(() => loadConfig({ ...env }), /MAIL_FROM is required/);
});

test("AC-17: the worker refuses to boot without STOREFRONT_URL", () => {
  const { STOREFRONT_URL: _omitted, ...env } = baseEnv;

  assert.throws(() => loadConfig({ ...env }), /STOREFRONT_URL is required/);
});

test("AC-17: defaults fill the port and the outbox folder", () => {
  const config = loadConfig({ ...baseEnv });

  assert.equal(config.workerPort, 5580);
  assert.equal(config.mailOutboxDir, "./tmp/mail");
  assert.equal(config.smtpUrl, undefined);
  assert.equal(config.storefrontUrl, "http://localhost:3000");
});

test("AC-17: SMTP_URL switches the transport away from the outbox", () => {
  const config = loadConfig({ ...baseEnv, SMTP_URL: "smtp://localhost:1025" });

  assert.equal(config.smtpUrl, "smtp://localhost:1025");
});

test("AC-16: WORKER_PORT overrides the health port", () => {
  const config = loadConfig({ ...baseEnv, WORKER_PORT: "6000" });

  assert.equal(config.workerPort, 6000);
  assert.throws(
    () => loadConfig({ ...baseEnv, WORKER_PORT: "not-a-port" }),
    /WORKER_PORT/,
  );
});
