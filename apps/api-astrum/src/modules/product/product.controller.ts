import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import type { ProductCategory } from "../../../generated/prisma/enums";
import { handleErrors } from "../../common/helpers/errorHandler";
import { productCategoryMap } from "../../common/helpers/productCategoryMap";
import type { AuthenticatedUserRequest } from "../../common/types/jwt.payload";
import { ProductService } from "./product.service";

const productService = new ProductService();

export class ProductController {
  async getProduct(req: Request, res: Response) {
    try {
      const { userId } = req as AuthenticatedUserRequest;
      const productId = req.params.productId as string;

      const product = await productService.getProduct(userId, productId);

      res.status(StatusCodes.OK).json(product);
    } catch (err) {
      handleErrors(res, err);
    }
  }

  async getRecommendations(req: Request, res: Response) {
    try {
      const { userId } = req as AuthenticatedUserRequest;
      const { cursor } = req.query;

      const products = await productService.getRecommendations(
        userId,
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
      const { userId } = req as AuthenticatedUserRequest;
      const category = req.params.category as string;

      const { cursor, search_query } = req.query;

      const productCategory = productCategoryMap[
        category.toLowerCase()
      ] as ProductCategory;

      const filters = {
        category: productCategory,
        search_query: search_query as string,
      };

      const products = await productService.getCategoryProducts(
        userId,
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
      const userData = await productService.createProduct(req.body);

      res.status(StatusCodes.OK).json(userData);
    } catch (err) {
      handleErrors(res, err);
    }
  }
}
