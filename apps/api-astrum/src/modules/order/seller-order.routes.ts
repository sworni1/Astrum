import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { requireActiveAccount } from "../../middlewares/requireActiveAccount";
import { validateDto } from "../../middlewares/validateDto";
import { UpdateOrderItemStatusDto } from "./dto/update-order-item-status.dto";
import { ORDER_ERROR_CODES } from "./order.constants";
import { OrderController } from "./order.controller";

const orderController = new OrderController();
const sellerOrderRoutes: Router = Router();

sellerOrderRoutes.get("/seller/orders", orderController.getSellerOrders);
sellerOrderRoutes.patch(
  "/seller/orders/:orderId/handover",
  requireActiveAccount,
  orderController.handOverOrder,
);
sellerOrderRoutes.patch(
  "/order-items/:orderItemId/status",
  requireActiveAccount,
  validateDto(UpdateOrderItemStatusDto, {
    status: StatusCodes.UNPROCESSABLE_ENTITY,
    code: ORDER_ERROR_CODES.validation,
  }),
  orderController.updateSellerOrderItemStatus,
);

export default sellerOrderRoutes;
