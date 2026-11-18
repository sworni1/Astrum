import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { handleErrors } from "../../common/helpers/errorHandler";
import { ownerForRead, ownerForWrite } from "../guest/guest.identity";
import { WishlistService } from "./wishlist.service";

const wishlistService = new WishlistService();

export class WishlistController {
  async getWishlist(req: Request, res: Response) {
    try {
      const wishlist = await wishlistService.getWishlist(ownerForRead(req));

      res.status(StatusCodes.OK).json(wishlist);
    } catch (err) {
      handleErrors(res, err);
    }
  }

  async addProductToWishlist(req: Request, res: Response) {
    try {
      const wishlistItem = await wishlistService.addProductToWishlist(
        ownerForWrite(req, res),
        req.body,
      );

      res.status(StatusCodes.OK).json(wishlistItem);
    } catch (err) {
      handleErrors(res, err);
    }
  }

  async deleteProductFromWishlist(req: Request, res: Response) {
    try {
      const productId = req.params.productId as string;

      const deletedProduct = await wishlistService.deleteProductFromWishlist(
        ownerForWrite(req, res),
        productId,
      );

      res.status(StatusCodes.OK).json(deletedProduct);
    } catch (err) {
      handleErrors(res, err);
    }
  }
}
