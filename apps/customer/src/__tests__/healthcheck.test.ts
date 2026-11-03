import { describe, expect, it } from "vitest";

describe("customer test infrastructure", () => {
  it("запускает vitest с jsdom", () => {
    expect(typeof window).toBe("object");
  });
});
