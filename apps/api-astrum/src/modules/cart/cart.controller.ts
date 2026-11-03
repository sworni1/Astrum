import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { handleErrors } from "../../common/helpers/errorHandler";
import { CartService } from "./cart.service";

const cartService = new CartService();

export class CartController {
  async getCart(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;

      const cart = await cartService.getCart(userId);

      res.status(StatusCodes.OK).json(cart);
    } catch (err) {
      handleErrors(res, err);
    }
  }

  async addProductToCart(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;

      const cartItem = await cartService.addProductToCart(userId, req.body);

      res.status(StatusCodes.OK).json(cartItem);
    } catch (err) {
      handleErrors(res, err);
    }
  }

  async changeProductCartQuantity(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const productId = req.params["productId"] as string;

      const cartItem = await cartService.changeProductCartQuantity(
        userId,
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
      const userId = (req as any).userId;
      const productId = req.params["productId"] as string;

      const deletedProduct = await cartService.deleteProductFromCart(
        userId,
        productId,
      );

      res.status(StatusCodes.OK).json(deletedProduct);
    } catch (err) {
      handleErrors(res, err);
    }
  }
}
