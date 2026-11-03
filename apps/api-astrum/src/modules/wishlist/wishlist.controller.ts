import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { handleErrors } from "../../common/helpers/errorHandler";
import { WishlistService } from "./wishlist.service";

const wishlistService = new WishlistService();

export class WishlistController {
  async getWishlist(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;

      const wishlist = await wishlistService.getWishlist(userId);

      res.status(StatusCodes.OK).json(wishlist);
    } catch (err) {
      handleErrors(res, err);
    }
  }

  async addProductToWishlist(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;

      const wishlistItem = await wishlistService.addProductToWishlist(
        userId,
        req.body,
      );

      res.status(StatusCodes.OK).json(wishlistItem);
    } catch (err) {
      handleErrors(res, err);
    }
  }

  async deleteProductFromWishlist(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const productId = req.params["productId"] as string;

      const deletedProduct = await wishlistService.deleteProductFromWishlist(
        userId,
        productId,
      );

      res.status(StatusCodes.OK).json(deletedProduct);
    } catch (err) {
      handleErrors(res, err);
    }
  }
}
