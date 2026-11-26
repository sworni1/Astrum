import { AppError } from "../../../common/helpers/appError";
import { ORDER_SEARCH_MAX_LENGTH } from "../constants/order.constants";
import {
  orderListWhere,
  parseOrderListQuery,
  parseSellerOrderQuery,
  sellerOrderWhere,
} from "../order-query";

const refusal = (raw: { status?: unknown; q?: unknown }): AppError => {
  try {
    parseOrderListQuery(raw);
  } catch (error) {
    if (error instanceof AppError) {
      return error;
    }

    throw error;
  }

  throw new Error("The query was accepted where a refusal was expected.");
};

describe("parseOrderListQuery", () => {
  it("отдаёт пустой фильтр, когда параметров нет (AC-2)", () => {
    expect(parseOrderListQuery({})).toEqual({});
  });

  it("читает ALL как отсутствие фильтра (AC-2)", () => {
    expect(parseOrderListQuery({ status: "ALL" })).toEqual({});
  });

  it("принимает оба настоящих статуса (AC-2)", () => {
    expect(parseOrderListQuery({ status: "DELIVERED" })).toEqual({
      status: "DELIVERED",
    });
    expect(parseOrderListQuery({ status: "CANCELED" })).toEqual({
      status: "CANCELED",
    });
  });

  it("отказывает статусу вне набора кодом INVALID_STATUS_FILTER (AC-2)", () => {
    const error = refusal({ status: "BOGUS" });

    expect(error.status).toBe(400);
    expect(error.code).toBe("INVALID_STATUS_FILTER");
  });

  it("не принимает нижний регистр и повторённый параметр (AC-2)", () => {
    expect(refusal({ status: "delivered" }).code).toBe("INVALID_STATUS_FILTER");
    expect(refusal({ status: ["ALL", "DELIVERED"] }).code).toBe(
      "INVALID_STATUS_FILTER",
    );
  });

  it("обрезает пробелы вокруг запроса (AC-2)", () => {
    expect(parseOrderListQuery({ q: "  parker  " })).toEqual({ q: "parker" });
  });

  it("считает пустой запрос отсутствием поиска (AC-2)", () => {
    expect(parseOrderListQuery({ q: "   " })).toEqual({});
    expect(parseOrderListQuery({ q: "" })).toEqual({});
  });

  it("принимает 64 символа и отказывает 65 кодом SEARCH_QUERY_TOO_LONG (AC-2)", () => {
    const atLimit = "a".repeat(ORDER_SEARCH_MAX_LENGTH);

    expect(parseOrderListQuery({ q: atLimit })).toEqual({ q: atLimit });

    const error = refusal({ q: "a".repeat(ORDER_SEARCH_MAX_LENGTH + 1) });

    expect(error.status).toBe(400);
    expect(error.code).toBe("SEARCH_QUERY_TOO_LONG");
  });

  it("отказывает повторённому запросу как неверной форме параметра (AC-2)", () => {
    const error = refusal({ q: ["parker", "urban"] });

    expect(error.status).toBe(400);
    expect(error.code).toBe("VALIDATION");
  });

  it("читает поиск в один символ, потому что набор заказов мал (AC-2)", () => {
    expect(parseOrderListQuery({ q: "p" })).toEqual({ q: "p" });
  });
});

describe("orderListWhere", () => {
  it("без фильтров ограничивает выборку владельцем (AC-1)", () => {
    expect(orderListWhere("user-1", {})).toEqual({ userId: "user-1" });
  });

  it("кладёт статус в один AND, а не рядом с userId (AC-3)", () => {
    expect(orderListWhere("user-1", { status: "DELIVERED" })).toEqual({
      userId: "user-1",
      AND: [{ status: { in: ["DELIVERED", "ISSUED"] } }],
    });
  });

  it("оставляет отменённый фильтр точным значением (AC-3)", () => {
    expect(orderListWhere("user-1", { status: "CANCELED" })).toEqual({
      userId: "user-1",
      AND: [{ status: "CANCELED" }],
    });
  });

  it("ищет по номеру заказа и по названию позиции одним OR (AC-3)", () => {
    expect(orderListWhere("user-1", { q: "parker" })).toEqual({
      userId: "user-1",
      AND: [
        {
          OR: [
            { id: { contains: "parker", mode: "insensitive" } },
            {
              OrderItem: {
                some: { name: { contains: "parker", mode: "insensitive" } },
              },
            },
          ],
        },
      ],
    });
  });

  it("складывает статус и поиск в два элемента одного AND (AC-3)", () => {
    const where = orderListWhere("user-1", { status: "CANCELED", q: "pen" });

    expect(Object.keys(where)).toEqual(["userId", "AND"]);
    expect(where.AND).toHaveLength(2);
    expect(where.AND).toEqual([
      { status: "CANCELED" },
      expect.objectContaining({ OR: expect.any(Array) }),
    ]);
  });
});

const sellerQuery = (raw: Record<string, unknown>) =>
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
    expect(sellerQuery({})).toEqual({});
    expect(sellerQuery({ status: "" })).toEqual({});
    expect(sellerQuery({ status: "ALL" })).toEqual({});
  });

  it("accepts the two real tabs and refuses the rest (AC-2)", () => {
    expect(sellerQuery({ status: "DELIVERED" })).toEqual({
      status: "DELIVERED",
    });
    expect(sellerQuery({ status: "CANCELED" })).toEqual({ status: "CANCELED" });
    expect(codeOf(() => sellerQuery({ status: "delivered" }))).toBe(
      "INVALID_STATUS_FILTER",
    );
    expect(codeOf(() => sellerQuery({ status: "CANCELLED" }))).toBe(
      "INVALID_STATUS_FILTER",
    );
  });

  it("refuses a repeated or non string status with its own code (AC-2)", () => {
    expect(codeOf(() => sellerQuery({ status: ["ALL", "DELIVERED"] }))).toBe(
      "INVALID_STATUS_FILTER",
    );
    expect(codeOf(() => sellerQuery({ status: 7 }))).toBe(
      "INVALID_STATUS_FILTER",
    );
  });

  it("trims the query once and reads an empty result as no search (AC-2)", () => {
    expect(sellerQuery({ q: "  drill  " })).toEqual({ q: "drill" });
    expect(sellerQuery({ q: "   " })).toEqual({});
    expect(sellerQuery({ q: "a" })).toEqual({ q: "a" });
  });

  it("keeps a 64 character query and refuses 65 (AC-2)", () => {
    expect(sellerQuery({ q: "x".repeat(64) })).toEqual({ q: "x".repeat(64) });
    expect(codeOf(() => sellerQuery({ q: "x".repeat(65) }))).toBe(
      "SEARCH_QUERY_TOO_LONG",
    );
    expect(sellerQuery({ q: ` ${"x".repeat(64)} ` })).toEqual({
      q: "x".repeat(64),
    });
  });

  it("refuses a repeated query with VALIDATION (AC-2)", () => {
    expect(codeOf(() => sellerQuery({ q: ["drill", "saw"] }))).toBe(
      "VALIDATION",
    );
    expect(codeOf(() => sellerQuery({ q: 12 }))).toBe("VALIDATION");
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

  it("filters DELIVERED on the line status pair delivered and issued (AC-2)", () => {
    expect(sellerOrderWhere("seller-1", { status: "DELIVERED" })).toEqual({
      business: { is: { ownerUserId: "seller-1" } },
      AND: [{ status: { in: ["DELIVERED", "ISSUED"] } }],
    });
  });

  it("combines the status and the search in one AND array (AC-2)", () => {
    expect(
      sellerOrderWhere("seller-1", { status: "DELIVERED", q: "drill" }),
    ).toEqual({
      business: { is: { ownerUserId: "seller-1" } },
      AND: [
        { status: { in: ["DELIVERED", "ISSUED"] } },
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
