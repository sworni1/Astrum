import assert from "node:assert/strict";
import { test } from "node:test";
import { describeError } from "./logger";

test("AC-4: an AggregateError reports the message hidden one level down", () => {
  const refused = new AggregateError(
    [new Error("connect ECONNREFUSED ::1:5672"), new Error("connect ECONNREFUSED 127.0.0.1:5672")],
    "",
  );

  assert.equal(
    describeError(refused),
    "connect ECONNREFUSED ::1:5672 | connect ECONNREFUSED 127.0.0.1:5672",
  );
});

test("AC-4: a plain error keeps its message, and a nameless one keeps its name", () => {
  assert.equal(describeError(new Error("socket closed")), "socket closed");
  assert.equal(describeError(new TypeError("")), "TypeError");
  assert.equal(describeError("boom"), "boom");
});
