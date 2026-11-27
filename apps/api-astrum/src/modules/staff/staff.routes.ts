import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { requireActiveAccount } from "../../middlewares/requireActiveAccount";
import {
  requireCourier,
  requirePointWorker,
} from "../../middlewares/staffRole";
import { validateDto } from "../../middlewares/validateDto";
import { STAFF_ERROR_CODES } from "./constants/staff.constants";
import { CourierOrderController } from "./courier-order.controller";
import { CreatePointWorkerDto } from "./dto/create-point-worker.dto";
import { PointOrderController } from "./point-order.controller";
import { StaffController } from "./staff.controller";

const controller = new StaffController();
const pointOrderController = new PointOrderController();
const courierOrderController = new CourierOrderController();
const staffRoutes: Router = Router();

const validatePoint = validateDto(CreatePointWorkerDto, {
  status: StatusCodes.UNPROCESSABLE_ENTITY,
  code: STAFF_ERROR_CODES.validation,
});

staffRoutes.post(
  "/staff/point-worker",
  requireActiveAccount,
  validatePoint,
  controller.grantPointWorker,
);

staffRoutes.patch(
  "/staff/point-worker",
  requireActiveAccount,
  requirePointWorker,
  validatePoint,
  controller.movePoint,
);

staffRoutes.post(
  "/staff/courier",
  requireActiveAccount,
  controller.grantCourier,
);

staffRoutes.get("/staff/point", requirePointWorker, controller.readPoint);

staffRoutes.get("/staff/courier", requireCourier, controller.readCourier);

staffRoutes.get(
  "/staff/point/orders",
  requirePointWorker,
  pointOrderController.listPointOrders,
);

staffRoutes.patch(
  "/staff/point/orders/:orderId/handover",
  requireActiveAccount,
  requirePointWorker,
  pointOrderController.handOver,
);

staffRoutes.patch(
  "/staff/point/orders/:orderId/cancel",
  requireActiveAccount,
  requirePointWorker,
  pointOrderController.cancel,
);

staffRoutes.get(
  "/staff/courier/orders",
  requireCourier,
  courierOrderController.listCourierOrders,
);

staffRoutes.post(
  "/staff/courier/orders/:orderId/claim",
  requireActiveAccount,
  requireCourier,
  courierOrderController.claim,
);

staffRoutes.delete(
  "/staff/courier/orders/:orderId/claim",
  requireActiveAccount,
  requireCourier,
  courierOrderController.release,
);

staffRoutes.patch(
  "/staff/courier/orders/:orderId/handover",
  requireActiveAccount,
  requireCourier,
  courierOrderController.handOver,
);

staffRoutes.patch(
  "/staff/courier/orders/:orderId/cancel",
  requireActiveAccount,
  requireCourier,
  courierOrderController.cancel,
);

export default staffRoutes;
