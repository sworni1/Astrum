import type { ClassConstructor } from "class-transformer";
import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { CreateOrderDto } from "../modules/order/dto/create-order.dto";
import { UpdateOrderItemStatusDto } from "../modules/order/dto/update-order-item-status.dto";
import { CreateProductDto } from "../modules/product/dto/create-product.dto";
import { validateDto } from "./validateDto";

type RunOptions = {
  status?: number;
  code?: string;
};

const runValidationWith = async <T extends object>(
  dtoClass: ClassConstructor<T>,
  body: unknown,
  options?: RunOptions,
) => {
  const req = { body } as Request;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as jest.Mocked<Response>;
  const next = jest.fn();

  await validateDto(dtoClass, options)(req, res, next);

  return { req, res, next };
};

const runValidation = (body: unknown, options?: RunOptions) =>
  runValidationWith(CreateOrderDto, body, options);

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

  it("принимает тело с суммами заказа и не пропускает их дальше (AC-6)", async () => {
    const { req, next } = await runValidation({
      ...validBody,
      shippingMethodName: "Free delivery",
      deliveryPrice: 0,
      grandTotal: 1,
    });

    expect(next).toHaveBeenCalled();
    expect(req.body).not.toHaveProperty("shippingMethodName");
    expect(req.body).not.toHaveProperty("deliveryPrice");
    expect(req.body).not.toHaveProperty("grandTotal");
    expect(req.body.shippingMethodId).toBe("ship-1");
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

  it("strips a caller supplied business id from product creation (AC-3)", async () => {
    const { req, next } = await runValidationWith(CreateProductDto, {
      name: "Drill",
      description: "A useful power drill",
      quantity: 3,
      price: 19.99,
      category: "Home",
      currency: "RUB",
      previewImage: "https://cdn.test/drill.png",
      businessId: "untrusted-business",
    });

    expect(next).toHaveBeenCalled();
    expect(req.body).not.toHaveProperty("businessId");
  });

  it("rejects a line status outside the enum with validation code (AC-7)", async () => {
    const { res, next } = await runValidationWith(
      UpdateOrderItemStatusDto,
      { status: "NOT_A_STATUS" },
      { status: StatusCodes.UNPROCESSABLE_ENTITY, code: "VALIDATION" },
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(StatusCodes.UNPROCESSABLE_ENTITY);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "VALIDATION" }),
    );
  });
});
