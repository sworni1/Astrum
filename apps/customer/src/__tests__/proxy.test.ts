import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { decrypt } from "@/common/helpers/session";
import proxy, { isGuestPath } from "@/proxy";

vi.mock("@/common/helpers/session", () => ({ decrypt: vi.fn() }));

const decryptMock = vi.mocked(decrypt);

const requestTo = (path: string, cookies: Record<string, string> = {}): NextRequest => {
  const request = new NextRequest(new URL(path, "http://localhost:3000"));

  for (const [name, value] of Object.entries(cookies)) {
    request.cookies.set(name, value);
  }

  return request;
};

beforeEach(() => {
  vi.clearAllMocks();
  decryptMock.mockResolvedValue(undefined);
});

describe("the storefront route policy", () => {
  it("renders the six guest paths (AC-13)", () => {
    for (const path of [
      "/",
      "/cart",
      "/wishlist",
      "/categories",
      "/categories/tires",
      "/products/product-1",
      "/auth/signin",
      "/auth/register",
    ]) {
      expect(isGuestPath(path)).toBe(true);
    }
  });

  it("keeps every other path behind the session (AC-13)", () => {
    for (const path of [
      "/checkout",
      "/orders",
      "/profile",
      "/seller/orders",
      "/point",
      "/courier",
      "/staff",
    ]) {
      expect(isGuestPath(path)).toBe(false);
    }
  });

  it("answers a guest with no redirect on a guest path (AC-13)", async () => {
    const answer = await proxy(requestTo("/cart"));

    expect(answer.headers.get("location")).toBeNull();
  });

  it("sends a guest to sign in and carries the path it wanted (AC-13)", async () => {
    const answer = await proxy(requestTo("/checkout"));

    const location = new URL(answer.headers.get("location") ?? "", "http://localhost:3000");

    expect(location.pathname).toBe("/auth/signin");
    expect(location.searchParams.get("next")).toBe("/checkout");
  });

  it("lets a signed session through any path (AC-13)", async () => {
    decryptMock.mockResolvedValue({ userId: "user-1" });

    const answer = await proxy(requestTo("/checkout", { __auth: "signed" }));

    expect(decryptMock).toHaveBeenCalledWith("signed");
    expect(answer.headers.get("location")).toBeNull();
  });

  it("drops a cookie it cannot verify on a guest path", async () => {
    const answer = await proxy(requestTo("/cart", { __auth: "broken" }));

    expect(answer.cookies.get("__auth")?.value).toBe("");
    expect(answer.headers.get("location")).toBeNull();
  });

  it("drops a cookie it cannot verify while sending the visitor to sign in", async () => {
    const answer = await proxy(requestTo("/checkout", { __auth: "broken" }));

    expect(answer.cookies.get("__auth")?.value).toBe("");
    expect(answer.headers.get("location")).toContain("/auth/signin");
  });

  it("keeps the cookie of a signed session", async () => {
    decryptMock.mockResolvedValue({ userId: "user-1" });

    const answer = await proxy(requestTo("/cart", { __auth: "signed" }));

    expect(answer.cookies.get("__auth")).toBeUndefined();
  });
});
