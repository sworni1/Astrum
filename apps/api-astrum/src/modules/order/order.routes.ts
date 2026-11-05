import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { requireActiveAccount } from "../../middlewares/requireActiveAccount";
import { validateDto } from "../../middlewares/validateDto";
import { CreateOrderDto } from "./dto/create-order.dto";
import { UpdateOrderStatusDto } from "./dto/update-order-status.dto";
import { attachIdempotencyKey } from "./idempotency";
import { ORDER_ERROR_CODES } from "./order.constants";
import { OrderController } from "./order.controller";

const orderController = new OrderController();

const orderRoutes: Router = Router();

orderRoutes.get("/", orderController.getOrdersByUserId);
orderRoutes.get("/:orderId", orderController.getOrderById);
orderRoutes.patch(
  "/:orderId/status",
  validateDto(UpdateOrderStatusDto, {
    status: StatusCodes.UNPROCESSABLE_ENTITY,
    code: ORDER_ERROR_CODES.validation,
  }),
  orderController.updateOrderStatus,
);
orderRoutes.post(
  "/",
  requireActiveAccount,
  attachIdempotencyKey,
  validateDto(CreateOrderDto, {
    status: StatusCodes.UNPROCESSABLE_ENTITY,
    code: ORDER_ERROR_CODES.validation,
  }),
  orderController.createOrder,
);

export default orderRoutes;
