import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ATTEMPT_HEADER,
  MAX_ATTEMPTS,
  RETRY_DELAYS_MS,
  attemptOf,
  retryQueueName,
} from "./topology";

test("AC-7: three delays of 60, 300 and 900 seconds", () => {
  assert.deepEqual([...RETRY_DELAYS_MS], [60_000, 300_000, 900_000]);
  assert.equal(MAX_ATTEMPTS, 4);
});

test("AC-7: the attempt header names the delivery, not the delay", () => {
  assert.equal(attemptOf(undefined), 1);
  assert.equal(attemptOf({}), 1);
  assert.equal(attemptOf({ [ATTEMPT_HEADER]: 2 }), 2);
  assert.equal(attemptOf({ [ATTEMPT_HEADER]: "3" }), 3);
  assert.equal(attemptOf({ [ATTEMPT_HEADER]: 0 }), 1);
  assert.equal(attemptOf({ [ATTEMPT_HEADER]: "nonsense" }), 1);
});

test("AC-7: every delay has its own waiting queue", () => {
  assert.equal(retryQueueName(1), "mail.confirmation.wait.1");
  assert.equal(retryQueueName(3), "mail.confirmation.wait.3");
});
