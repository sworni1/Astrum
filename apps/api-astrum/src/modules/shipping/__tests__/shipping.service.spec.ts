jest.mock("../../../../lib/prisma", () => ({
  prisma: { shippingMethod: { findMany: jest.fn() } },
}));

import { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../../lib/prisma";
import {
  toShippingMethodJson,
  toShippingMethodListJson,
} from "../shipping.mapper";
import { ShippingService } from "../shipping.service";

const findMany = (
  prisma as unknown as { shippingMethod: { findMany: jest.Mock } }
).shippingMethod.findMany;

describe("ShippingService.getActiveMethods", () => {
  beforeEach(() => {
    findMany.mockReset();
  });

  it("читает только активные методы в порядке имени, с флагом pickup (AC-4)", async () => {
    findMany.mockResolvedValue([]);

    await new ShippingService().getActiveMethods();

    expect(findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        price: true,
        currency: true,
        isPickup: true,
      },
    });
  });

  it("не пропускает выключенный метод в ответ (AC-4)", async () => {
    findMany.mockResolvedValue([
      {
        id: "sm-1",
        name: "Standard Delivery",
        price: new Prisma.Decimal("299.00"),
        currency: "RUB",
        isPickup: false,
      },
    ]);

    const methods = await new ShippingService().getActiveMethods();

    expect(findMany.mock.calls[0][0].where).toEqual({ isActive: true });
    expect(toShippingMethodListJson(methods)).toEqual({
      methods: [
        {
          id: "sm-1",
          name: "Standard Delivery",
          price: 299,
          currency: "RUB",
          isPickup: false,
        },
      ],
    });
  });

  it("отдаёт true у точки самовывоза и false у курьера (AC-4)", async () => {
    findMany.mockResolvedValue([
      {
        id: "sm-pickup",
        name: "Pickup at the shop",
        price: new Prisma.Decimal("0.00"),
        currency: "RUB",
        isPickup: true,
      },
      {
        id: "sm-courier",
        name: "Express Delivery",
        price: new Prisma.Decimal("799.00"),
        currency: "RUB",
        isPickup: false,
      },
    ]);

    const methods = await new ShippingService().getActiveMethods();

    expect(toShippingMethodListJson(methods)).toEqual({
      methods: [
        {
          id: "sm-pickup",
          name: "Pickup at the shop",
          price: 0,
          currency: "RUB",
          isPickup: true,
        },
        {
          id: "sm-courier",
          name: "Express Delivery",
          price: 799,
          currency: "RUB",
          isPickup: false,
        },
      ],
    });
  });
});

describe("shipping mapper", () => {
  it("отдаёт ровно пять полей и цену числом (AC-4)", () => {
    expect(
      toShippingMethodJson({
        id: "sm-1",
        name: "Standard Delivery",
        price: new Prisma.Decimal("299.00"),
        currency: "RUB",
        isPickup: false,
      }),
    ).toEqual({
      id: "sm-1",
      name: "Standard Delivery",
      price: 299,
      currency: "RUB",
      isPickup: false,
    });
  });

  it("держит два знака у дробной цены (AC-4)", () => {
    const json = toShippingMethodJson({
      id: "sm-2",
      name: "Express Delivery",
      price: new Prisma.Decimal("799.5"),
      currency: "RUB",
      isPickup: false,
    });

    expect(json.price).toBe(799.5);
  });

  it("оборачивает список в ключ methods (AC-4)", () => {
    expect(toShippingMethodListJson([])).toEqual({ methods: [] });
  });
});
