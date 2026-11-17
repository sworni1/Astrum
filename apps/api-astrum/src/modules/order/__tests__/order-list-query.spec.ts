import { AppError } from "../../../common/helpers/appError";
import { ORDER_SEARCH_MAX_LENGTH } from "../constants/order.constants";
import { orderListWhere, parseOrderListQuery } from "../order-list-query";

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
      AND: [{ status: "DELIVERED" }],
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
