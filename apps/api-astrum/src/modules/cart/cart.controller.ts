import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { handleErrors } from "../../common/helpers/errorHandler";
import type { AuthenticatedUserRequest } from "../../common/types/jwt.payload";
import {
  clearGuestCookie,
  ownerForRead,
  ownerForWrite,
  readGuestId,
} from "../guest/guest.identity";
import { GuestMergeService } from "../guest/guest-merge.service";
import { CartService } from "./cart.service";

const cartService = new CartService();
const guestMergeService = new GuestMergeService();

export class CartController {
  async getCart(req: Request, res: Response) {
    try {
      const cart = await cartService.getCart(ownerForRead(req));

      res.status(StatusCodes.OK).json(cart);
    } catch (err) {
      handleErrors(res, err);
    }
  }

  async addProductToCart(req: Request, res: Response) {
    try {
      const cartItem = await cartService.addProductToCart(
        ownerForWrite(req, res),
        req.body,
      );

      res.status(StatusCodes.OK).json(cartItem);
    } catch (err) {
      handleErrors(res, err);
    }
  }

  async changeProductCartQuantity(req: Request, res: Response) {
    try {
      const productId = req.params.productId as string;

      const cartItem = await cartService.changeProductCartQuantity(
        ownerForWrite(req, res),
        productId,
        req.body,
      );

      res.status(StatusCodes.OK).json(cartItem);
    } catch (err) {
      handleErrors(res, err);
    }
  }

  async deleteProductFromCart(req: Request, res: Response) {
    try {
      const productId = req.params.productId as string;

      const deletedProduct = await cartService.deleteProductFromCart(
        ownerForWrite(req, res),
        productId,
      );

      res.status(StatusCodes.OK).json(deletedProduct);
    } catch (err) {
      handleErrors(res, err);
    }
  }

  async mergeGuestCart(req: Request, res: Response) {
    try {
      const { userId } = req as AuthenticatedUserRequest;

      const counts = await guestMergeService.merge(userId, readGuestId(req));

      clearGuestCookie(res);

      res.status(StatusCodes.OK).json(counts);
    } catch (err) {
      handleErrors(res, err);
    }
  }
}
