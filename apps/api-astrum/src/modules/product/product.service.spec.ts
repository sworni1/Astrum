jest.mock("../../../lib/prisma", () => ({
  prisma: {
    business: { findUnique: jest.fn() },
    product: { create: jest.fn() },
  },
}));

import { prisma } from "../../../lib/prisma";
import { AppError } from "../../common/helpers/appError";
import type { CreateProductDto } from "./dto/create-product.dto";
import { ProductService } from "./product.service";

const prismaMock = prisma as unknown as {
  business: { findUnique: jest.Mock };
  product: { create: jest.Mock };
};

const createProductDto = {
  name: "Drill",
  description: "A useful power drill",
  quantity: 3,
  price: 19.99,
  category: "Home",
  currency: "RUB",
  previewImage: "https://cdn.test/drill.png",
} as const;

describe("ProductService.createProduct", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses the business assigned to the authenticated user", async () => {
    prismaMock.business.findUnique.mockResolvedValue({ id: "owned-business" });
    prismaMock.product.create.mockImplementation(({ data }) =>
      Promise.resolve(data),
    );

    await new ProductService().createProduct("seller-1", {
      ...createProductDto,
      businessId: "untrusted-business",
    } as CreateProductDto);

    expect(prismaMock.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ businessId: "owned-business" }),
    });
  });

  it("refuses product creation when the user has no assigned business", async () => {
    prismaMock.business.findUnique.mockResolvedValue(null);

    await expect(
      new ProductService().createProduct(
        "seller-1",
        createProductDto as CreateProductDto,
      ),
    ).rejects.toMatchObject({
      status: 403,
      code: "SELLER_NOT_ASSIGNED",
    } satisfies Partial<AppError>);
    expect(prismaMock.product.create).not.toHaveBeenCalled();
  });
});
