import { Request, Response } from "express";
import { OrderService } from "./order.service";
import { handleErrors } from "../../common/helpers/errorHandler";
import { StatusCodes } from "http-status-codes";

const orderService = new OrderService();

export class OrderController {
  async createOrder(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;

      const order = await orderService.createOrder(userId, req.body);

      res.status(StatusCodes.OK).json(order);
    } catch (error) {
      handleErrors(res, error);
    }
  }

  async getOrdersByUserId(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;

      const order = await orderService.getOrdersByUserId(userId);

      res.status(StatusCodes.OK).json(order);
    } catch (error) {
      handleErrors(res, error);
    }
  }

  async getOrderById(req: Request, res: Response) {
    try {
      const orderId = req.params["orderId"] as string;

      const order = await orderService.getOrderById(orderId);

      res.status(StatusCodes.OK).json(order);
    } catch (error) {
      handleErrors(res, error);
    }
  }
}
