import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateOrderDto } from "./create-order.dto";

const bodyOf = (overrides: Record<string, unknown> = {}) => ({
  deliveryDate: "2026-12-01T12:00:00.000Z",
  shippingMethodId: "sm-1",
  paymentMethod: "CASH",
  paymentDetails: "Cash on delivery",
  orderItems: [{ productId: "p-1", quantity: 1 }],
  ...overrides,
});

const dtoOf = (body: Record<string, unknown>): CreateOrderDto =>
  plainToInstance(CreateOrderDto, body, { excludeExtraneousValues: true });

const failingProperties = async (
  body: Record<string, unknown>,
): Promise<string[]> =>
  (await validate(dtoOf(body))).map((error) => error.property);

describe("CreateOrderDto", () => {
  it("требует адрес, когда точки нет (AC-7)", async () => {
    expect(await failingProperties(bodyOf())).toEqual(["deliveryAddress"]);
  });

  it("пропускает тело без адреса, когда названа точка (AC-7)", async () => {
    expect(
      await failingProperties(bodyOf({ pickupPointId: "pp-1" })),
    ).toEqual([]);
  });

  it("пропускает тело с адресом и без точки (AC-7)", async () => {
    expect(
      await failingProperties(bodyOf({ deliveryAddress: "Lenina 1" })),
    ).toEqual([]);
  });

  it("отказывает пустой строке в pickupPointId (AC-7)", async () => {
    expect(
      await failingProperties(bodyOf({ pickupPointId: "" })),
    ).toContain("pickupPointId");
  });

  it("срезает поля снимка, которые прислал клиент (AC-7)", () => {
    const dto = dtoOf(
      bodyOf({
        pickupPointId: "pp-1",
        pickupPointName: "Forged point",
        pickupPointAddress: "Forged address",
        handedOverAt: "2026-01-01T00:00:00.000Z",
      }),
    ) as CreateOrderDto & Record<string, unknown>;

    expect(dto.pickupPointId).toBe("pp-1");
    expect(dto.pickupPointName).toBeUndefined();
    expect(dto.pickupPointAddress).toBeUndefined();
    expect(dto.handedOverAt).toBeUndefined();
  });
});
