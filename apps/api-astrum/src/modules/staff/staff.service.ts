import { StatusCodes } from "http-status-codes";
import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../../lib/prisma";
import { AppError } from "../../common/helpers/appError";
import { logger } from "../../common/helpers/logger";
import { staffRolesOf } from "../../common/helpers/staffRoles";
import type { StaffPointView, StaffRole } from "../../common/types/staff.types";
import { STAFF_ERROR_CODES } from "./constants/staff.constants";

/** What every staff endpoint answers: the roles held, and the point where one applies. */
export type StaffAnswer = {
  staffRoles: StaffRole[];
  point: StaffPointView | null;
};

const POINT_SELECT = {
  id: true,
  name: true,
  address: true,
  isActive: true,
} as const;

const ROLE_SELECT = {
  pointWorker: { select: { pickupPointId: true } },
  courier: { select: { id: true } },
} as const;

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

/**
 * The staff roles of an account. A grant, a move and both reads answer with
 * this list, read from the two relations of `User` in one query.
 */
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

  /** One statement, no refusals: the reads serve a point that was switched off. */
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

  /**
   * The point a grant or a move may name. Read before the insert, with no
   * transaction and no row lock: a point switched off between this read and the
   * write still leaves a worker attached to it, which the reads handle (AC-5).
   */
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

  /**
   * One row per account. A repeat and a lost race both answer with the stored
   * row, so the unique index on `userId` stays the only guard (AC-6).
   */
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

  /** The courier row carries no point, so there is nothing to validate (AC-7). */
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

  /**
   * The point change writes only the caller's own row. A request naming the
   * stored point answers with it and writes nothing (AC-8).
   */
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

  /** The point read serves a point that was switched off (AC-9). */
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
