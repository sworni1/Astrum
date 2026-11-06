import assert from "node:assert/strict";
import { test } from "node:test";
import type { ConsumeMessage } from "amqplib";
import { createConfirmationHandler } from "./consumer";
import type { Letter } from "./letter";
import type { Mailer } from "./mailer";
import {
  ATTEMPT_HEADER,
  CONFIRMATION_QUEUE,
  DEAD_LETTER_QUEUE,
  retryQueueName,
} from "./topology";

type Sent = { queue: string; headers: Record<string, unknown> };

const event = Buffer.from(
  JSON.stringify({ userId: "user-1", email: "customer@example.test" }),
);

const buildMessage = (headers?: Record<string, unknown>): ConsumeMessage =>
  ({
    content: event,
    properties: { headers },
    fields: {
      consumerTag: "tag",
      deliveryTag: 1,
      redelivered: false,
      exchange: "",
      routingKey: "",
    },
  }) as unknown as ConsumeMessage;

const buildHarness = (send: () => Promise<void>) => {
  const sent: Sent[] = [];
  const state = { acks: 0, nacks: 0, letters: 0 };

  const channel = {
    ack: () => {
      state.acks += 1;
    },
    nack: () => {
      state.nacks += 1;
    },
    sendToQueue: (
      queue: string,
      _content: Buffer,
      options: { headers?: Record<string, unknown> },
    ) => {
      sent.push({ queue, headers: options?.headers ?? {} });
      return true;
    },
    waitForConfirms: async () => {},
  };

  const prisma = {
    user: { findUnique: async () => ({ email: "customer@example.test" }) },
    emailToken: {
      updateMany: async () => ({ count: 0 }),
      create: async () => ({}),
    },
    $transaction: async (operations: unknown[]) => operations,
  };

  const mailer: Mailer = {
    kind: "smtp",
    send: async (_to: string, _letter: Letter) => {
      state.letters += 1;
      await send();
    },
  };

  const handler = createConfirmationHandler({
    channel: channel as never,
    prisma: prisma as never,
    mailer,
    storefrontUrl: "https://shop.example",
  });

  return { handler, sent, state };
};

const failing = () =>
  Promise.reject(new Error("connect ECONNREFUSED ::1:1025"));
const succeeding = () => Promise.resolve();

test("AC-7: the first failure waits 60 s and hands over attempt 2", async () => {
  const { handler, sent, state } = buildHarness(failing);

  await handler(buildMessage());

  assert.equal(sent.length, 1);
  assert.equal(sent[0].queue, retryQueueName(1));
  assert.equal(sent[0].headers[ATTEMPT_HEADER], 2);
  assert.equal(state.acks, 1);
});

test("AC-7: a redelivery moves to the 300 s queue and counts attempt 2", async () => {
  const { handler, sent } = buildHarness(failing);

  await handler(buildMessage({ [ATTEMPT_HEADER]: 2 }));

  assert.equal(sent.length, 1);
  assert.equal(sent[0].queue, retryQueueName(2));
  assert.equal(sent[0].headers[ATTEMPT_HEADER], 3);
});

test("AC-7: the third failure moves to the 900 s queue and counts attempt 3", async () => {
  const { handler, sent } = buildHarness(failing);

  await handler(buildMessage({ [ATTEMPT_HEADER]: 3 }));

  assert.equal(sent.length, 1);
  assert.equal(sent[0].queue, retryQueueName(3));
  assert.equal(sent[0].headers[ATTEMPT_HEADER], 4);
});

test("AC-7: the fourth failure dead letters instead of retrying again", async () => {
  const { handler, sent, state } = buildHarness(failing);

  await handler(buildMessage({ [ATTEMPT_HEADER]: 4 }));

  assert.equal(sent.length, 1);
  assert.equal(sent[0].queue, DEAD_LETTER_QUEUE);
  assert.equal(sent[0].headers[ATTEMPT_HEADER], 4);
  assert.match(String(sent[0].headers["x-last-error"]), /ECONNREFUSED/);
  assert.equal(state.acks, 1);
});

test("AC-7: a success on a later attempt sends one letter and never retries", async () => {
  const { handler, sent, state } = buildHarness(succeeding);

  await handler(buildMessage({ [ATTEMPT_HEADER]: 3 }));

  assert.equal(sent.length, 0);
  assert.equal(state.letters, 1);
  assert.equal(state.acks, 1);
  assert.notEqual(CONFIRMATION_QUEUE, sent[0]?.queue);
});
