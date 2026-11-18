import { describe, expect, it } from "vitest";
import { acceptedReturnPath } from "@/common/helpers/returnPath";

describe("acceptedReturnPath", () => {
  it("accepts the two paths that need an account (AC-15)", () => {
    expect(acceptedReturnPath("/checkout")).toBe("/checkout");
    expect(acceptedReturnPath("/cart")).toBe("/cart");
  });

  it("falls back to the home page for anything else (AC-15)", () => {
    for (const value of [
      "https://evil.example",
      "//evil.example",
      "/orders",
      "/checkout/../profile",
      "",
      null,
      undefined,
    ]) {
      expect(acceptedReturnPath(value)).toBe("/");
    }
  });
});
