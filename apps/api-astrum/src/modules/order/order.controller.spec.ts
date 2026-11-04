jest.mock("../../../lib/prisma", () => ({ prisma: {} }));

import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { Prisma } from "../../../generated/prisma/client";
import { AppError } from "../../common/helpers/appError";
import { OrderController } from "./order.controller";
import { OrderService } from "./order.service";

const createMockResponse = (): jest.Mocked<Response> => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as jest.Mocked<Response>;
  return res;
};

const createRequest = (overrides: Record<string, unknown> = {}): Request =>
  Object.assign(Object.create(null) as Request, {
    params: {},
    body: {},
    userId: "user-1",
    ...overrides,
  });

const orderDetail = {
  id: "order-1",
  userId: "user-1",
  status: "PENDING",
  totalPrice: new Prisma.Decimal("70.95"),
  currency: "RUB",
  shippingMethod: { name: "Standard", price: 5.99 },
  orderItems: [{ id: "line-1", price: new Prisma.Decimal("19.99") }],
};

describe("OrderController", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("отвечает 201 и деньгами числом на создание заказа (AC-9)", async () => {
    jest
      .spyOn(OrderService.prototype, "createOrder")
      .mockResolvedValue(orderDetail as never);
    const res = createMockResponse();

    await new OrderController().createOrder(createRequest(), res);

    expect(res.status).toHaveBeenCalledWith(StatusCodes.CREATED);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "order-1",
        totalPrice: 70.95,
        currency: "RUB",
        orderItems: [expect.objectContaining({ price: 19.99 })],
      }),
    );
  });

  it("отдаёт 404 на чужой заказ через handleErrors (AC-8)", async () => {
    jest
      .spyOn(OrderService.prototype, "getOrderById")
      .mockRejectedValue(
        new AppError(
          404,
          "ORDER_NOT_FOUND",
          "Order not found for this customer.",
        ),
      );
    const res = createMockResponse();

    await new OrderController().getOrderById(
      createRequest({ params: { orderId: "order-9" } }),
      res,
    );

    expect(OrderService.prototype.getOrderById).toHaveBeenCalledWith(
      "order-9",
      "user-1",
    );
    expect(res.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND);
    expect(res.json).toHaveBeenCalledWith({
      code: "ORDER_NOT_FOUND",
      message: "Order not found for this customer.",
    });
  });

  it("отдаёт список заказов с totalPrice числом (AC-9)", async () => {
    jest
      .spyOn(OrderService.prototype, "getOrdersByUserId")
      .mockResolvedValue([
        { id: "order-1", totalPrice: new Prisma.Decimal("10.00") },
      ] as never);
    const res = createMockResponse();

    await new OrderController().getOrdersByUserId(createRequest(), res);

    expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
    expect(res.json).toHaveBeenCalledWith([{ id: "order-1", totalPrice: 10 }]);
  });

  it("отвечает 200 на отмену заказа и отдаёт деньги числом (AC-1)", async () => {
    jest
      .spyOn(OrderService.prototype, "updateOrderStatus")
      .mockResolvedValue({ ...orderDetail, status: "CANCELED" } as never);
    const res = createMockResponse();

    await new OrderController().updateOrderStatus(
      createRequest({
        params: { orderId: "order-1" },
        body: { status: "CANCELED" },
      }),
      res,
    );

    expect(OrderService.prototype.updateOrderStatus).toHaveBeenCalledWith(
      "order-1",
      "user-1",
      "CANCELED",
    );
    expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: "CANCELED", totalPrice: 70.95 }),
    );
  });

  it("отдаёт 409 на запрещённый переход через handleErrors (AC-4)", async () => {
    jest
      .spyOn(OrderService.prototype, "updateOrderStatus")
      .mockRejectedValue(
        new AppError(
          409,
          "INVALID_STATUS_TRANSITION",
          "A SHIPPED order can no longer be cancelled.",
          { from: "SHIPPED", to: "CANCELED" },
        ),
      );
    const res = createMockResponse();

    await new OrderController().updateOrderStatus(
      createRequest({
        params: { orderId: "order-1" },
        body: { status: "CANCELED" },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(StatusCodes.CONFLICT);
    expect(res.json).toHaveBeenCalledWith({
      code: "INVALID_STATUS_TRANSITION",
      message: "A SHIPPED order can no longer be cancelled.",
      from: "SHIPPED",
      to: "CANCELED",
    });
  });
});
