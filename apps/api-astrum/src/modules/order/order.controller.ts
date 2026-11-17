import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { handleErrors } from "../../common/helpers/errorHandler";
import { toOrderJson, toOrderListJson } from "./order.mapper";
import { parseOrderListQuery } from "./order-list-query";
import { OrderService } from "./order.service";
import { parseSellerOrderQuery } from "./seller-order-query";
import { SellerOrderService } from "./seller-order.service";

const orderService = new OrderService();
const sellerOrderService = new SellerOrderService();

const userIdOf = (req: Request): string =>
  (req as Request & { userId: string }).userId;


export class OrderController {
  async createOrder(req: Request, res: Response) {
    try {
      const { order, replay } = await orderService.createOrder(
        userIdOf(req),
        req.body,
        res.locals.idempotencyKey as string | undefined,
      );

      if (replay) {
        res.setHeader("Idempotent-Replay", "true");
      }

      res
        .status(replay ? StatusCodes.OK : StatusCodes.CREATED)
        .json(toOrderJson(order));
    } catch (error) {
      handleErrors(res, error);
    }
  }

  async getOrdersByUserId(req: Request, res: Response) {
    try {
      const page = await orderService.getOrdersByUserId(
        userIdOf(req),
        parseOrderListQuery(req.query),
      );

      res.status(StatusCodes.OK).json(toOrderListJson(page));
    } catch (error) {
      handleErrors(res, error);
    }
  }

  async getSellerOrders(req: Request, res: Response) {
    try {
      const page = await sellerOrderService.getSellerOrders(
        userIdOf(req),
        parseSellerOrderQuery(req.query),
        req.query.page,
        req.query.limit,
      );

      res.status(StatusCodes.OK).json(page);
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
