import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import authenticateToken from "../../middlewares/authenticateToken";
import { validateDto } from "../../middlewares/validateDto";
import { CreateOrderDto } from "./dto/create-order.dto";
import { ORDER_ERROR_CODES } from "./order.constants";
import { OrderController } from "./order.controller";

const orderController = new OrderController();

const orderRoutes: Router = Router();

orderRoutes.get("/", authenticateToken, orderController.getOrdersByUserId);
orderRoutes.get("/:orderId", authenticateToken, orderController.getOrderById);
orderRoutes.post(
  "/",
  authenticateToken,
  validateDto(CreateOrderDto, {
    status: StatusCodes.UNPROCESSABLE_ENTITY,
    code: ORDER_ERROR_CODES.validation,
  }),
  orderController.createOrder,
);

export default orderRoutes;
