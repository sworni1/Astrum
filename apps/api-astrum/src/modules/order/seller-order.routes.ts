import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { requireActiveAccount } from "../../middlewares/requireActiveAccount";
import { validateDto } from "../../middlewares/validateDto";
import { UpdateOrderItemStatusDto } from "./dto/update-order-item-status.dto";
import { ORDER_ERROR_CODES } from "./order.constants";
import { OrderController } from "./order.controller";
import { requireSellerOrderWorkflow } from "./seller-order-workflow.config";

const orderController = new OrderController();
const sellerOrderRoutes: Router = Router();

sellerOrderRoutes.get(
  "/seller/orders",
  requireSellerOrderWorkflow,
  orderController.getSellerOrders,
);
sellerOrderRoutes.patch(
  "/order-items/:orderItemId/status",
  requireActiveAccount,
  requireSellerOrderWorkflow,
  validateDto(UpdateOrderItemStatusDto, {
    status: StatusCodes.UNPROCESSABLE_ENTITY,
    code: ORDER_ERROR_CODES.validation,
  }),
  orderController.updateSellerOrderItemStatus,
);

export default sellerOrderRoutes;
