import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { prisma } from "../../lib/prisma";
import { logger } from "../common/helpers/logger";
import type { AuthenticatedRequest } from "../common/types/jwt.payload";
import type {
  StaffRequest,
  StaffRole,
  StaffRoleRow,
} from "../common/types/staff.types";
import { STAFF_ERROR_CODES } from "../modules/staff/constants/staff.constants";

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const refuse = (
  res: Response,
  status: number,
  code: string,
  message: string,
) => {
  res.status(status).json({ code, message });
};

/** One indexed read of the caller's own row; a courier names no point. */
const readOwnRow = async (
  role: StaffRole,
  userId: string,
): Promise<StaffRoleRow | null> => {
  if (role === "POINT_WORKER") {
    const row = await prisma.pointWorker.findUnique({
      where: { userId },
      select: { pickupPointId: true },
    });

    return row ? { role, pickupPointId: row.pickupPointId } : null;
  }

  const row = await prisma.courier.findUnique({
    where: { userId },
    select: { userId: true },
  });

  return row ? { role, pickupPointId: null } : null;
};

type StaffRoleGuardConfig = {
  role: StaffRole;
  refusalCode: string;
  event: string;
  message: string;
};

/**
 * The authorisation rule of a staff role: the role row is read by the
 * authenticated id on every call, so a grant takes effect on the next request
 * and no cache goes stale. A failed read is a 503, never a 403, because an
 * outage must not read as a missing role (spec 0017, AC-10).
 */
export const createStaffRoleGuard =
  ({ role, refusalCode, event, message }: StaffRoleGuardConfig) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { userId } = req as AuthenticatedRequest;
    const route = { method: req.method, path: `${req.baseUrl}${req.path}` };

    let row: StaffRoleRow | null;

    try {
      row = await readOwnRow(role, userId);
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
        "The staff role could not be read",
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

export const requirePointWorker = createStaffRoleGuard({
  role: "POINT_WORKER",
  refusalCode: STAFF_ERROR_CODES.notPointWorker,
  event: "staff.point-worker.refused",
  message: "This account does not work at a pickup point",
});

export const requireCourier = createStaffRoleGuard({
  role: "COURIER",
  refusalCode: STAFF_ERROR_CODES.notCourier,
  event: "staff.courier.refused",
  message: "This account is not a courier",
});
