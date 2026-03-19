import { Router } from "express";
import { OrderController } from "./order.controller";
import { validateDto } from "../../middlewares/validateDto";
import { CreateOrderDto } from "./dto/create-order.dto";
import authenticateToken from "../../middlewares/authenticateToken";

const orderController = new OrderController();

const orderRoutes = Router();

orderRoutes.get("/", authenticateToken, orderController.getOrdersByUserId);
orderRoutes.get("/:orderId", authenticateToken, orderController.getOrderById);
orderRoutes.post(
  "/",
  authenticateToken,
  validateDto(CreateOrderDto),
  orderController.createOrder
);

export default orderRoutes;
