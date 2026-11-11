import { describe, expect, it } from "vitest";
import { stepperWidth } from "./styles";

describe("stepperWidth", () => {
  it("fills the whole row on a shop card", () => {
    expect(stepperWidth({ size: "full" })).toBe("w-full");
  });

  it("keeps a fixed column from the small breakpoint up", () => {
    expect(stepperWidth({ size: "sm" })).toBe("w-full sm:w-[14rem]");
  });

  it("falls back to the card size", () => {
    expect(stepperWidth({})).toBe("w-full");
  });
});
