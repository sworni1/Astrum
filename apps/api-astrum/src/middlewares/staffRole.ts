import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { describeError } from "../common/helpers/describeError";
import { logger } from "../common/helpers/logger";
import type { AuthenticatedRequest } from "../common/types/jwt.payload";
import type { StaffRequest, StaffRoleRow } from "../common/types/staff.types";
import { STAFF_ERROR_CODES } from "../modules/staff/constants/staff.constants";
import {
  STAFF_ROLE_GUARD_CONFIGS,
  STAFF_ROLE_UNAVAILABLE_MESSAGE,
  type StaffRoleGuardConfig,
} from "./constants/staff-role.constants";
import { refuse, routeOf } from "./helpers/http.helpers";
import { readStaffRoleRow } from "./helpers/staff-role.helpers";

export const createStaffRoleGuard =
  ({ role, refusalCode, event, message }: StaffRoleGuardConfig) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { userId } = req as AuthenticatedRequest;
    const route = routeOf(req);

    let row: StaffRoleRow | null;

    try {
      row = await readStaffRoleRow(role, userId);
    } catch (error) {
      logger.error({
        event: "staff.role.unavailable",
        ...route,
        userId,
        role,
        reason: describeError(error),
      });
      refuse(
        res,
        StatusCodes.SERVICE_UNAVAILABLE,
        STAFF_ERROR_CODES.roleUnavailable,
        STAFF_ROLE_UNAVAILABLE_MESSAGE,
      );
      return;
    }

    if (!row) {
      logger.warn({ event, ...route, userId, role });
      refuse(res, StatusCodes.FORBIDDEN, refusalCode, message);
      return;
    }

    (req as StaffRequest).staff = row;
    next();
  };

export const requirePointWorker = createStaffRoleGuard(
  STAFF_ROLE_GUARD_CONFIGS.POINT_WORKER,
);

export const requireCourier = createStaffRoleGuard(
  STAFF_ROLE_GUARD_CONFIGS.COURIER,
);
