import { AppError } from "../../../common/helpers/appError";
import { parseSellerOrderQuery, sellerOrderWhere } from "../seller-order-query";

const query = (raw: Record<string, unknown>) =>
  parseSellerOrderQuery(raw as { status?: unknown; q?: unknown });

const codeOf = (run: () => unknown): string => {
  try {
    run();
  } catch (error) {
    return error instanceof AppError ? error.code : "NOT_AN_APP_ERROR";
  }

  return "NO_THROW";
};

describe("parseSellerOrderQuery", () => {
  it("treats an absent, empty and ALL status as no filter (AC-2)", () => {
    expect(query({})).toEqual({});
    expect(query({ status: "" })).toEqual({});
    expect(query({ status: "ALL" })).toEqual({});
  });

  it("accepts the two real tabs and refuses the rest (AC-2)", () => {
    expect(query({ status: "DELIVERED" })).toEqual({ status: "DELIVERED" });
    expect(query({ status: "CANCELED" })).toEqual({ status: "CANCELED" });
    expect(codeOf(() => query({ status: "delivered" }))).toBe(
      "INVALID_STATUS_FILTER",
    );
    expect(codeOf(() => query({ status: "CANCELLED" }))).toBe(
      "INVALID_STATUS_FILTER",
    );
  });

  it("refuses a repeated or non string status with its own code (AC-2)", () => {
    expect(codeOf(() => query({ status: ["ALL", "DELIVERED"] }))).toBe(
      "INVALID_STATUS_FILTER",
    );
    expect(codeOf(() => query({ status: 7 }))).toBe("INVALID_STATUS_FILTER");
  });

  it("trims the query once and reads an empty result as no search (AC-2)", () => {
    expect(query({ q: "  drill  " })).toEqual({ q: "drill" });
    expect(query({ q: "   " })).toEqual({});
    expect(query({ q: "a" })).toEqual({ q: "a" });
  });

  it("keeps a 64 character query and refuses 65 (AC-2)", () => {
    expect(query({ q: "x".repeat(64) })).toEqual({ q: "x".repeat(64) });
    expect(codeOf(() => query({ q: "x".repeat(65) }))).toBe(
      "SEARCH_QUERY_TOO_LONG",
    );
    expect(query({ q: ` ${"x".repeat(64)} ` })).toEqual({ q: "x".repeat(64) });
  });

  it("refuses a repeated query with VALIDATION (AC-2)", () => {
    expect(codeOf(() => query({ q: ["drill", "saw"] }))).toBe("VALIDATION");
    expect(codeOf(() => query({ q: 12 }))).toBe("VALIDATION");
  });
});

describe("sellerOrderWhere", () => {
  it("scopes every read to the session account's business (AC-2)", () => {
    expect(sellerOrderWhere("seller-1", {})).toEqual({
      business: { is: { ownerUserId: "seller-1" } },
    });
  });

  it("expands CANCELED to the pair CANCELLED and OUT_OF_STOCK (AC-2)", () => {
    expect(sellerOrderWhere("seller-1", { status: "CANCELED" })).toEqual({
      business: { is: { ownerUserId: "seller-1" } },
      AND: [{ status: { in: ["CANCELLED", "OUT_OF_STOCK"] } }],
    });
  });

  it("filters DELIVERED on the line status alone (AC-2)", () => {
    expect(sellerOrderWhere("seller-1", { status: "DELIVERED" })).toEqual({
      business: { is: { ownerUserId: "seller-1" } },
      AND: [{ status: "DELIVERED" }],
    });
  });

  it("combines the status and the search in one AND array (AC-2)", () => {
    expect(
      sellerOrderWhere("seller-1", { status: "DELIVERED", q: "drill" }),
    ).toEqual({
      business: { is: { ownerUserId: "seller-1" } },
      AND: [
        { status: "DELIVERED" },
        {
          OR: [
            { name: { contains: "drill", mode: "insensitive" } },
            { orderId: { contains: "drill", mode: "insensitive" } },
          ],
        },
      ],
    });
  });
});
