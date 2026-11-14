import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { requireActiveAccount } from "../../middlewares/requireActiveAccount";
import {
  requireCourier,
  requirePointWorker,
} from "../../middlewares/staffRole";
import { validateDto } from "../../middlewares/validateDto";
import { STAFF_ERROR_CODES } from "./constants/staff.constants";
import { CreatePointWorkerDto } from "./dto/create-point-worker.dto";
import { CourierOrderController } from "./courier-order.controller";
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

// The writes carry the account gate; the role guard sits after it, so a
// PENDING account is refused before its role is read (AC-8).
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

// A read is open to a PENDING account: confirmation gates writes only (AC-9).
staffRoutes.get("/staff/point", requirePointWorker, controller.readPoint);

staffRoutes.get("/staff/courier", requireCourier, controller.readCourier);

// The counter's queue and its two writes. The read stays open to a PENDING
// account, and each write carries the account gate before the role guard
// (spec 0018, AC-1, AC-4, AC-6).
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

// The courier's pool and its four writes. No write takes a body, so none mounts
// `validateDto`; the scope of the read is checked in the controller, because
// `validateDto` reads a body only (spec 0019, AC-2 to AC-8).
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
