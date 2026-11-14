import type { Request, Response } from "express";
import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../../common/helpers/appError";
import { handleErrors } from "../../common/helpers/errorHandler";
import { logger } from "../../common/helpers/logger";
import type { AuthenticatedUserRequest } from "../../common/types/jwt.payload";
import { ORDER_ERROR_CODES } from "./constants/order.constants";
import { OrderController } from "./order.controller";

const orderController = new OrderController();
const sellerOrderRoutes: Router = Router();

const sellerPanelReadOnly = () =>
  new AppError(
    StatusCodes.NOT_FOUND,
    ORDER_ERROR_CODES.sellerPanelReadOnly,
    "Seller writes were removed; the panel is read only.",
  );

/**
 * Both seller write paths answer one typed refusal and write nothing: the point
 * worker and the courier hand a parcel over, so a shop owner holds no authority
 * here. The handler answers directly instead of throwing, because `app.ts`
 * mounts no error middleware and a thrown error would leave the project shape.
 * A stale bundle still reaches it, and the log line is the only signal.
 */
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
