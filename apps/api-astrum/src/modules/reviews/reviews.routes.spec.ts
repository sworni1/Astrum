jest.mock("../../../lib/prisma", () => ({
  prisma: { user: { findUnique: jest.fn() } },
}));

import type { AddressInfo } from "node:net";
import express from "express";
import { prisma } from "../../../lib/prisma";
import type { AuthenticatedUserRequest } from "../../common/types/jwt.payload";
import productRoutes from "../product/product.routes";
import { ReviewsService } from "./reviews.service";

/**
 * The router is mounted under the product path by the product module, so this
 * spec boots the real parent router: the only way to prove the child receives
 * the parent's param is to send a request through it (spec 0012, AC-11).
 */
describe("productReviewsRouter params", () => {
  let server: ReturnType<express.Express["listen"]>;
  let baseUrl = "";

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as AuthenticatedUserRequest).userId = "user-1";
      next();
    });
    app.use("/api/products", productRoutes);

    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    (
      (prisma as unknown as { user: { findUnique: jest.Mock } }).user.findUnique
    ).mockResolvedValue({ status: "ACTIVE" });
  });

  it("hands the product id from the path to the service (AC-1, AC-12)", async () => {
    const list = jest
      .spyOn(ReviewsService.prototype, "getReviewsForProduct")
      .mockResolvedValue({
        reviews: [],
        nextCursor: null,
        hasNextPage: false,
        aggregate: {
          total: 0,
          averageRating: 0,
          distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
        },
      });

    const response = await fetch(`${baseUrl}/api/products/product-from-path/reviews?limit=2`);

    expect(response.status).toBe(200);
    expect(list).toHaveBeenCalledWith("product-from-path", {
      after: undefined,
      limit: "2",
    });
  });

  it("never reads the product from the request body (AC-11)", async () => {
    const create = jest
      .spyOn(ReviewsService.prototype, "createReview")
      .mockResolvedValue({ id: "review-1" } as never);

    await fetch(`${baseUrl}/api/products/product-from-path/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: "product-from-body",
        orderItemId: "line-1",
        rating: 5,
        qualityRating: 5,
        deliveryRating: 5,
        accuracyRating: 5,
        comment: "solid drill",
      }),
    });

    expect(create).toHaveBeenCalledWith(
      "user-1",
      "product-from-path",
      expect.not.objectContaining({ productId: "product-from-body" }),
    );
  });
});
