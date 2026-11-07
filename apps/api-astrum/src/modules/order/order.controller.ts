import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import type { OrderItemStatus } from "../../../generated/prisma/enums";
import { handleErrors } from "../../common/helpers/errorHandler";
import { toOrderJson, toOrderListJson } from "./order.mapper";
import { OrderService } from "./order.service";
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
      const orders = await orderService.getOrdersByUserId(userIdOf(req));

      res.status(StatusCodes.OK).json(toOrderListJson(orders));
    } catch (error) {
      handleErrors(res, error);
    }
  }

  async getSellerOrders(req: Request, res: Response) {
    try {
      const { orders, ...pagination } =
        await sellerOrderService.getSellerOrders(
          userIdOf(req),
          req.query.page,
          req.query.limit,
        );

      res.status(StatusCodes.OK).json({
        ...pagination,
        orders: orders.map(({ orderItems, ...order }) => ({
          ...order,
          orderItems: orderItems.map((item) => ({
            ...item,
            price: Number(item.price.toFixed(2)),
          })),
        })),
      });
    } catch (error) {
      handleErrors(res, error);
    }
  }

  async updateSellerOrderItemStatus(req: Request, res: Response) {
    try {
      const item = await sellerOrderService.updateSellerOrderItemStatus(
        req.params.orderItemId as string,
        userIdOf(req),
        req.body.status as OrderItemStatus,
      );

      res.status(StatusCodes.OK).json({
        ...item,
        price: Number(item.price.toFixed(2)),
      });
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
