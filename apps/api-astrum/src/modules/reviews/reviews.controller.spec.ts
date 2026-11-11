import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { ReviewsController } from "./reviews.controller";
import { ReviewsService } from "./reviews.service";

jest.mock("../../../lib/prisma", () => ({ prisma: {} }));

describe("ReviewsController.createReview", () => {
  it("returns the created review without a sentiment result", async () => {
    const review = { id: "review-id", comment: "Great product" };
    const createReview = jest
      .spyOn(ReviewsService.prototype, "createReview")
      .mockResolvedValue(review as never);
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as jest.Mocked<Response>;
    const req = Object.assign(Object.create(null) as Request, {
      params: { productId: "product-id" },
      userId: "user-id",
      body: {},
    });

    await new ReviewsController().createReview(req, res);

    expect(createReview).toHaveBeenCalledWith(
      "user-id",
      "product-id",
      req.body,
    );
    expect(res.status).toHaveBeenCalledWith(StatusCodes.CREATED);
    expect(res.json).toHaveBeenCalledWith(review);
  });
});
