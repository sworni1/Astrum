import type { Request, Response } from "express";
import { Router } from "express";
import { handleErrors } from "../../common/helpers/errorHandler";
import { logger } from "../../common/helpers/logger";
import type { AuthenticatedUserRequest } from "../../common/types/jwt.payload";
import { sellerPanelReadOnly } from "./helpers/order-errors.helpers";
import { OrderController } from "./order.controller";

const orderController = new OrderController();
const sellerOrderRoutes: Router = Router();

export const refuseSellerWrite = (req: Request, res: Response): void => {
  const { orderId, orderItemId } = req.params;

  logger.warn({
    event: "seller.write_refused",
    userId: (req as AuthenticatedUserRequest).userId,
    method: req.method,
    path: req.originalUrl,
    ...(orderId ? { orderId } : { orderItemId }),
  });

  handleErrors(res, sellerPanelReadOnly());
};

sellerOrderRoutes.get("/seller/orders", orderController.getSellerOrders);
sellerOrderRoutes.patch("/seller/orders/:orderId/handover", refuseSellerWrite);
sellerOrderRoutes.patch("/order-items/:orderItemId/status", refuseSellerWrite);

export default sellerOrderRoutes;
