import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { CreateOrderDto } from "../modules/order/dto/create-order.dto";
import { validateDto } from "./validateDto";

type RunOptions = {
  status?: number;
  code?: string;
};

const runValidation = async (body: unknown, options?: RunOptions) => {
  const req = { body } as Request;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as jest.Mocked<Response>;
  const next = jest.fn();

  await validateDto(CreateOrderDto, options)(req, res, next);

  return { req, res, next };
};

const validBody = {
  deliveryAddress: "Lenina 1",
  deliveryDate: "2026-11-10T12:00:00.000Z",
  shippingMethodId: "ship-1",
  paymentMethod: "CASH",
  paymentDetails: "Cash on delivery",
  orderItems: [{ productId: "product-1", quantity: 2 }],
};

describe("validateDto", () => {
  it("выбрасывает price, name и previewImage, присланные браузером (AC-1)", async () => {
    const { req, next } = await runValidation({
      ...validBody,
      orderItems: [
        {
          productId: "product-1",
          quantity: 2,
          price: 1,
          name: "lol",
          previewImage: "http://evil/image.png",
        },
      ],
    });

    expect(next).toHaveBeenCalled();
    expect(req.body.orderItems).toEqual([
      { productId: "product-1", quantity: 2 },
    ]);
  });

  it("по умолчанию отвечает 400 и без кода", async () => {
    const { res, next } = await runValidation({ ...validBody, orderItems: [] });

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
    expect(res.json).toHaveBeenCalledWith({
      errors: expect.any(Array),
    });
  });

  it("отвечает 422 с кодом VALIDATION, когда статус и код переданы (AC-7)", async () => {
    const { res } = await runValidation(
      { ...validBody, orderItems: [{ productId: "product-1", quantity: 0 }] },
      {
        status: StatusCodes.UNPROCESSABLE_ENTITY,
        code: "VALIDATION",
      },
    );

    expect(res.status).toHaveBeenCalledWith(StatusCodes.UNPROCESSABLE_ENTITY);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "VALIDATION",
        errors: expect.any(Array),
      }),
    );
  });

  it("отказывает списку из 51 строки (AC-7)", async () => {
    const orderItems = Array.from({ length: 51 }, (_, index) => ({
      productId: `product-${index}`,
      quantity: 1,
    }));

    const { res } = await runValidation(
      { ...validBody, orderItems },
      { status: StatusCodes.UNPROCESSABLE_ENTITY, code: "VALIDATION" },
    );

    expect(res.status).toHaveBeenCalledWith(StatusCodes.UNPROCESSABLE_ENTITY);
  });

  it("отказывает дробному количеству (AC-7)", async () => {
    const { res } = await runValidation(
      { ...validBody, orderItems: [{ productId: "product-1", quantity: 1.5 }] },
      { status: StatusCodes.UNPROCESSABLE_ENTITY, code: "VALIDATION" },
    );

    expect(res.status).toHaveBeenCalledWith(StatusCodes.UNPROCESSABLE_ENTITY);
  });
});
