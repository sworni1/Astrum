const serviceMock = {
  listCourierOrders: jest.fn(),
  claim: jest.fn(),
  release: jest.fn(),
  handOver: jest.fn(),
  cancelOrder: jest.fn(),
};

jest.mock("../courier-order.service", () => ({
  CourierOrderService: jest.fn(() => serviceMock),
}));

import type { Request, Response } from "express";
import { CourierOrderController } from "../courier-order.controller";

type Answer = { status?: number; body?: Record<string, unknown> };

const resDouble = (): { res: Response; answer: Answer } => {
  const answer: Answer = {};
  const res = {
    status: jest.fn((code: number) => {
      answer.status = code;
      return res;
    }),
    json: jest.fn((body: Record<string, unknown>) => {
      answer.body = body;
      return res;
    }),
  } as unknown as Response;

  return { res, answer };
};

const requestOf = (query: Record<string, unknown>): Request =>
  ({ query, params: {}, userId: "courier-1" }) as unknown as Request;

const controller = new CourierOrderController();

describe("CourierOrderController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    serviceMock.listCourierOrders.mockResolvedValue({
      orders: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
  });

  it("defaults the scope to mine and passes page and limit through (AC-2)", async () => {
    const { res, answer } = resDouble();

    await controller.listCourierOrders(
      requestOf({ page: "2", limit: "5" }),
      res,
    );

    expect(serviceMock.listCourierOrders).toHaveBeenCalledWith(
      "courier-1",
      "mine",
      "2",
      "5",
    );
    expect(answer.status).toBe(200);
    expect(answer.body).toEqual({
      orders: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
  });

  it("accepts the available scope (AC-2)", async () => {
    const { res } = resDouble();

    await controller.listCourierOrders(requestOf({ scope: "available" }), res);

    expect(serviceMock.listCourierOrders).toHaveBeenCalledWith(
      "courier-1",
      "available",
      undefined,
      undefined,
    );
  });

  it("refuses any other scope with 422 VALIDATION (AC-2)", async () => {
    const { res, answer } = resDouble();

    await controller.listCourierOrders(requestOf({ scope: "all" }), res);

    expect(answer.status).toBe(422);
    expect(answer.body).toMatchObject({ code: "VALIDATION" });
    expect(serviceMock.listCourierOrders).not.toHaveBeenCalled();
  });

  it("refuses a repeated scope that arrives as an array (AC-2)", async () => {
    const { res, answer } = resDouble();

    await controller.listCourierOrders(
      requestOf({ scope: ["mine", "available"] }),
      res,
    );

    expect(answer.status).toBe(422);
    expect(answer.body).toMatchObject({ code: "VALIDATION" });
    expect(serviceMock.listCourierOrders).not.toHaveBeenCalled();
  });

  it("answers the order of each write with 200 (AC-4 to AC-8)", async () => {
    serviceMock.claim.mockResolvedValue({ order: { id: "order-1" } });
    serviceMock.release.mockResolvedValue({ order: { id: "order-1" } });
    serviceMock.handOver.mockResolvedValue({ order: { id: "order-1" } });
    serviceMock.cancelOrder.mockResolvedValue({ order: { id: "order-1" } });

    for (const call of [
      controller.claim.bind(controller),
      controller.release.bind(controller),
      controller.handOver.bind(controller),
      controller.cancel.bind(controller),
    ]) {
      const { res, answer } = resDouble();
      const request = {
        query: {},
        params: { orderId: "order-1" },
        userId: "courier-1",
      } as unknown as Request;

      await call(request, res);

      expect(answer.status).toBe(200);
      expect(answer.body).toEqual({ order: { id: "order-1" } });
    }

    expect(serviceMock.claim).toHaveBeenCalledWith("order-1", "courier-1");
    expect(serviceMock.release).toHaveBeenCalledWith("order-1", "courier-1");
    expect(serviceMock.handOver).toHaveBeenCalledWith("order-1", "courier-1");
    expect(serviceMock.cancelOrder).toHaveBeenCalledWith(
      "order-1",
      "courier-1",
    );
  });

  it("paints a service refusal through the shared error shape (AC-14)", async () => {
    const { AppError } = await import("../../../common/helpers/appError");

    serviceMock.claim.mockRejectedValue(
      new AppError(409, "ALREADY_CLAIMED", "Another courier took this parcel."),
    );

    const { res, answer } = resDouble();
    const request = {
      query: {},
      params: { orderId: "order-1" },
      userId: "courier-1",
    } as unknown as Request;

    await controller.claim(request, res);

    expect(answer.status).toBe(409);
    expect(answer.body).toMatchObject({
      code: "ALREADY_CLAIMED",
      message: "Another courier took this parcel.",
    });
  });
});
