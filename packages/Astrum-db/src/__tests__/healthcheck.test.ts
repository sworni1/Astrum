import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Astrum-db test infrastructure", () => {
  it("запускает node:test через tsx", () => {
    assert.equal(1 + 1, 2);
  });
});
