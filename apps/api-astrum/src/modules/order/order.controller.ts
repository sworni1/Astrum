import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { handleErrors } from "../../common/helpers/errorHandler";
import { toOrderJson, toOrderListJson } from "./order.mapper";
import { OrderService } from "./order.service";

const orderService = new OrderService();

const userIdOf = (req: Request): string =>
  (req as Request & { userId: string }).userId;

export class OrderController {
  async createOrder(req: Request, res: Response) {
    try {
      const order = await orderService.createOrder(userIdOf(req), req.body);

      res.status(StatusCodes.CREATED).json(toOrderJson(order));
    } catch (error) {
      handleErrors(res, error);
    }
  }

  async getOrdersByUserId(req: Request, res: Response) {
    try {
      const orders = await orderService.getOrdersByUserId(userIdOf(req));

      res.status(StatusCodes.OK).json(toOrderListJson(orders));
    } catch (error) {
      handleErrors(res, error);
    }
  }

  async getOrderById(req: Request, res: Response) {
    try {
      const order = await orderService.getOrderById(
        req.params.orderId as string,
        userIdOf(req),
      );

      res.status(StatusCodes.OK).json(toOrderJson(order));
    } catch (error) {
      handleErrors(res, error);
    }
  }

  async updateOrderStatus(req: Request, res: Response) {
    try {
      const order = await orderService.updateOrderStatus(
        req.params.orderId as string,
        userIdOf(req),
        req.body.status,
      );

      res.status(StatusCodes.OK).json(toOrderJson(order));
    } catch (error) {
      handleErrors(res, error);
    }
  }
}
