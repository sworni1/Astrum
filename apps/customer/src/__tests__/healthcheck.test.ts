import { describe, expect, it } from "vitest";

describe("customer test infrastructure", () => {
  it("runs vitest with jsdom", () => {
    expect(typeof window).toBe("object");
  });
});
