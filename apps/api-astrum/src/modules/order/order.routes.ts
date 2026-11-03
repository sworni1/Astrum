import { Router } from "express";
import authenticateToken from "../../middlewares/authenticateToken";
import { validateDto } from "../../middlewares/validateDto";
import { CreateOrderDto } from "./dto/create-order.dto";
import { OrderController } from "./order.controller";

const orderController = new OrderController();

const orderRoutes: Router = Router();

orderRoutes.get("/", authenticateToken, orderController.getOrdersByUserId);
orderRoutes.get("/:orderId", authenticateToken, orderController.getOrderById);
orderRoutes.post(
  "/",
  authenticateToken,
  validateDto(CreateOrderDto),
  orderController.createOrder,
);

export default orderRoutes;
