import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { handleErrors } from "../../common/helpers/errorHandler";
import type { AuthenticatedUserRequest } from "../../common/types/jwt.payload";
import { ownerForRead } from "../guest/guest.identity";
import { resolveProductCategory } from "./helpers/product-category.helpers";
import { ProductService } from "./product.service";

const productService = new ProductService();

export class ProductController {
  async getProduct(req: Request, res: Response) {
    try {
      const productId = req.params.productId as string;

      const product = await productService.getProduct(
        ownerForRead(req),
        productId,
      );

      res.status(StatusCodes.OK).json(product);
    } catch (err) {
      handleErrors(res, err);
    }
  }

  async getRecommendations(req: Request, res: Response) {
    try {
      const { cursor } = req.query;

      const products = await productService.getRecommendations(
        ownerForRead(req),
        {},
        cursor as string,
      );

      res.status(StatusCodes.OK).json(products);
    } catch (err) {
      handleErrors(res, err);
    }
  }

  async getCategoryProducts(req: Request, res: Response) {
    try {
      const category = req.params.category as string;

      const { cursor, search_query } = req.query;

      const productCategory = resolveProductCategory(category);

      const filters = {
        category: productCategory,
        search_query: search_query as string,
      };

      const products = await productService.getCategoryProducts(
        ownerForRead(req),
        filters,
        cursor as string,
      );

      res.status(StatusCodes.OK).json(products);
    } catch (err) {
      handleErrors(res, err);
    }
  }

  async createProduct(req: Request, res: Response) {
    try {
      const { userId } = req as AuthenticatedUserRequest;
      const userData = await productService.createProduct(userId, req.body);

      res.status(StatusCodes.OK).json(userData);
    } catch (err) {
      handleErrors(res, err);
    }
  }
}
