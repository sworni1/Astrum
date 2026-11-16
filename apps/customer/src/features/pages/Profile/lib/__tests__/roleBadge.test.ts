import { describe, expect, it } from "vitest";
import { avatarInitial, roleBadgeKey } from "@/features/pages/Profile/lib/roleBadge";

describe("roleBadgeKey", () => {
  it("labels a seller as a seller (AC-8)", () => {
    expect(roleBadgeKey(true, [])).toBe("roleSeller");
    expect(roleBadgeKey(true, ["COURIER"])).toBe("roleSeller");
  });

  it("labels an account holding a staff role as staff (AC-8)", () => {
    expect(roleBadgeKey(false, ["POINT_WORKER"])).toBe("roleStaff");
    expect(roleBadgeKey(false, ["POINT_WORKER", "COURIER"])).toBe("roleStaff");
  });

  it("labels a plain account as a buyer (AC-8)", () => {
    expect(roleBadgeKey(false, [])).toBe("roleBuyer");
    expect(roleBadgeKey(false, undefined)).toBe("roleBuyer");
  });
});

describe("avatarInitial", () => {
  it("takes the first glyph of the nickname, upper cased (AC-4)", () => {
    expect(avatarInitial("wefr")).toBe("W");
    expect(avatarInitial("  Иван")).toBe("И");
  });

  it("falls back to a question mark for an empty nickname (AC-4)", () => {
    expect(avatarInitial("")).toBe("?");
    expect(avatarInitial("   ")).toBe("?");
    expect(avatarInitial(null)).toBe("?");
    expect(avatarInitial(undefined)).toBe("?");
  });
});
