import { StatusCodes } from "http-status-codes";
import { prisma } from "../../../lib/prisma";
import { AppError } from "../../common/helpers/appError";
import { logger } from "../../common/helpers/logger";
import { isUniqueViolation } from "../../common/helpers/prismaErrors";
import { staffRolesOf } from "../../common/helpers/staffRoles";
import type { StaffPointView, StaffRole } from "../../common/types/staff.types";
import {
  POINT_SELECT,
  ROLE_SELECT,
  STAFF_ERROR_CODES,
} from "./constants/staff.constants";

export type StaffAnswer = {
  staffRoles: StaffRole[];
  point: StaffPointView | null;
};

export class StaffService {
  private async staffRoles(userId: string): Promise<StaffRole[]> {
    const row = await prisma.user.findUnique({
      where: { id: userId },
      select: ROLE_SELECT,
    });

    if (!row) {
      throw new AppError(
        StatusCodes.UNAUTHORIZED,
        "SESSION_REVOKED",
        "The session is no longer valid",
      );
    }

    return staffRolesOf(row);
  }

  private async readPointRow(pickupPointId: string): Promise<StaffPointView> {
    const point = await prisma.pickupPoint.findUnique({
      where: { id: pickupPointId },
      select: POINT_SELECT,
    });

    if (!point) {
      throw new Error(`Pickup point ${pickupPointId} is missing its row`);
    }

    return point;
  }

  private async requireActivePoint(
    pickupPointId: string,
  ): Promise<StaffPointView> {
    const point = await prisma.pickupPoint.findUnique({
      where: { id: pickupPointId },
      select: POINT_SELECT,
    });

    if (!point) {
      throw new AppError(
        StatusCodes.CONFLICT,
        STAFF_ERROR_CODES.unknownPickupPoint,
        "That pickup point does not exist",
      );
    }

    if (!point.isActive) {
      throw new AppError(
        StatusCodes.CONFLICT,
        STAFF_ERROR_CODES.pickupPointInactive,
        "That pickup point is closed",
      );
    }

    return point;
  }

  private async answerAt(
    userId: string,
    pickupPointId: string,
  ): Promise<StaffAnswer> {
    const [staffRoles, point] = await Promise.all([
      this.staffRoles(userId),
      this.readPointRow(pickupPointId),
    ]);

    return { staffRoles, point };
  }

  private async storedPointId(userId: string): Promise<string | null> {
    const row = await prisma.pointWorker.findUnique({
      where: { userId },
      select: { pickupPointId: true },
    });

    return row?.pickupPointId ?? null;
  }

  async grantPointWorker(
    userId: string,
    pickupPointId: string,
  ): Promise<StaffAnswer> {
    const stored = await this.storedPointId(userId);

    if (stored) {
      return this.answerAt(userId, stored);
    }

    const point = await this.requireActivePoint(pickupPointId);

    try {
      await prisma.pointWorker.create({ data: { userId, pickupPointId } });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const winner = await this.storedPointId(userId);

        if (winner) {
          return this.answerAt(userId, winner);
        }
      }

      throw error;
    }

    logger.info({ event: "staff.point-worker.granted", userId, pickupPointId });

    return { staffRoles: await this.staffRoles(userId), point };
  }

  async grantCourier(userId: string): Promise<StaffAnswer> {
    const existing = await prisma.courier.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!existing) {
      try {
        await prisma.courier.create({ data: { userId } });
        logger.info({ event: "staff.courier.granted", userId });
      } catch (error) {
        if (!isUniqueViolation(error)) {
          throw error;
        }
      }
    }

    return { staffRoles: await this.staffRoles(userId), point: null };
  }

  async movePoint(userId: string, pickupPointId: string): Promise<StaffAnswer> {
    const stored = await this.storedPointId(userId);

    if (!stored) {
      throw new AppError(
        StatusCodes.FORBIDDEN,
        STAFF_ERROR_CODES.notPointWorker,
        "This account does not work at a pickup point",
      );
    }

    if (stored === pickupPointId) {
      return this.answerAt(userId, stored);
    }

    const point = await this.requireActivePoint(pickupPointId);

    await prisma.pointWorker.update({
      where: { userId },
      data: { pickupPointId },
    });

    logger.info({ event: "staff.point-worker.moved", userId, pickupPointId });

    return { staffRoles: await this.staffRoles(userId), point };
  }

  async readPoint(userId: string): Promise<StaffAnswer> {
    const stored = await this.storedPointId(userId);

    if (!stored) {
      throw new AppError(
        StatusCodes.FORBIDDEN,
        STAFF_ERROR_CODES.notPointWorker,
        "This account does not work at a pickup point",
      );
    }

    return this.answerAt(userId, stored);
  }

  async readCourier(userId: string): Promise<StaffAnswer> {
    return { staffRoles: await this.staffRoles(userId), point: null };
  }
}
