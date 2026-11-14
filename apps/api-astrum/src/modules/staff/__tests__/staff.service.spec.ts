jest.mock("../../../../lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    pickupPoint: { findUnique: jest.fn() },
    pointWorker: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    courier: { findUnique: jest.fn(), create: jest.fn() },
  },
}));

import { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../../lib/prisma";
import { logger } from "../../../common/helpers/logger";
import { StaffService } from "../staff.service";

const prismaMock = prisma as unknown as {
  user: { findUnique: jest.Mock };
  pickupPoint: { findUnique: jest.Mock };
  pointWorker: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
  courier: { findUnique: jest.Mock; create: jest.Mock };
};

const POINT = {
  id: "pp-1",
  name: "Central Pickup",
  address: "Tverskaya 12",
  isActive: true,
};

const otherPoint = {
  id: "pp-2",
  name: "South Pickup",
  address: "Lenina 4",
  isActive: true,
};

const uniqueViolation = (): Prisma.PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "7.10.1",
  });

const service = new StaffService();

describe("StaffService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    prismaMock.user.findUnique.mockResolvedValue({
      pointWorker: { pickupPointId: "pp-1" },
      courier: null,
    });
    prismaMock.pointWorker.findUnique.mockResolvedValue(null);
    prismaMock.pointWorker.create.mockResolvedValue({});
    prismaMock.pointWorker.update.mockResolvedValue({});
    prismaMock.courier.findUnique.mockResolvedValue(null);
    prismaMock.courier.create.mockResolvedValue({});
    prismaMock.pickupPoint.findUnique.mockResolvedValue(POINT);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("grantPointWorker", () => {
    it("creates one row for the account and answers the stored point (AC-4)", async () => {
      const info = jest.spyOn(logger, "info");

      const answer = await service.grantPointWorker("user-1", "pp-1");

      expect(prismaMock.pointWorker.create).toHaveBeenCalledWith({
        data: { userId: "user-1", pickupPointId: "pp-1" },
      });
      expect(answer).toEqual({
        staffRoles: ["POINT_WORKER"],
        point: POINT,
      });
      expect(info).toHaveBeenCalledWith({
        event: "staff.point-worker.granted",
        userId: "user-1",
        pickupPointId: "pp-1",
      });
    });

    it("refuses an unknown point with 409 and writes nothing (AC-5)", async () => {
      prismaMock.pickupPoint.findUnique.mockResolvedValue(null);

      await expect(
        service.grantPointWorker("user-1", "pp-unknown"),
      ).rejects.toMatchObject({
        status: 409,
        code: "UNKNOWN_PICKUP_POINT",
      });
      expect(prismaMock.pointWorker.create).not.toHaveBeenCalled();
    });

    it("refuses a closed point with 409 and writes nothing (AC-5)", async () => {
      prismaMock.pickupPoint.findUnique.mockResolvedValue({
        ...POINT,
        isActive: false,
      });

      await expect(
        service.grantPointWorker("user-1", "pp-1"),
      ).rejects.toMatchObject({
        status: 409,
        code: "PICKUP_POINT_INACTIVE",
      });
      expect(prismaMock.pointWorker.create).not.toHaveBeenCalled();
    });

    it("answers the stored row on a repeat, whatever point the body carries (AC-6)", async () => {
      prismaMock.pointWorker.findUnique.mockResolvedValue({
        pickupPointId: "pp-1",
      });
      const info = jest.spyOn(logger, "info");

      const answer = await service.grantPointWorker("user-1", "pp-2");

      expect(prismaMock.pointWorker.create).not.toHaveBeenCalled();
      expect(prismaMock.pointWorker.update).not.toHaveBeenCalled();
      expect(answer.point).toEqual(POINT);
      expect(info).not.toHaveBeenCalled();
    });

    it("answers from a fresh read of the winner row when the unique index decides a race (AC-6)", async () => {
      prismaMock.pointWorker.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ pickupPointId: "pp-1" });
      prismaMock.pointWorker.create.mockRejectedValue(uniqueViolation());
      const info = jest.spyOn(logger, "info");

      const answer = await service.grantPointWorker("user-1", "pp-2");

      expect(answer).toEqual({ staffRoles: ["POINT_WORKER"], point: POINT });
      expect(info).not.toHaveBeenCalled();
    });

    it("rethrows any other write failure so the route answers 500 (AC-6)", async () => {
      prismaMock.pointWorker.create.mockRejectedValue(
        new Error("connection lost"),
      );

      await expect(service.grantPointWorker("user-1", "pp-1")).rejects.toThrow(
        "connection lost",
      );
    });
  });

  describe("grantCourier", () => {
    it("creates one row and answers the roles without a point (AC-7)", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        pointWorker: null,
        courier: { id: "c-1" },
      });
      const info = jest.spyOn(logger, "info");

      const answer = await service.grantCourier("user-1");

      expect(prismaMock.courier.create).toHaveBeenCalledWith({
        data: { userId: "user-1" },
      });
      expect(answer).toEqual({ staffRoles: ["COURIER"], point: null });
      expect(info).toHaveBeenCalledWith({
        event: "staff.courier.granted",
        userId: "user-1",
      });
    });

    it("creates nothing on a repeat and logs none (AC-7)", async () => {
      prismaMock.courier.findUnique.mockResolvedValue({ id: "c-1" });
      prismaMock.user.findUnique.mockResolvedValue({
        pointWorker: null,
        courier: { id: "c-1" },
      });
      const info = jest.spyOn(logger, "info");

      const answer = await service.grantCourier("user-1");

      expect(prismaMock.courier.create).not.toHaveBeenCalled();
      expect(answer.staffRoles).toEqual(["COURIER"]);
      expect(info).not.toHaveBeenCalled();
    });

    it("settles a race through the unique index and still answers 200 (AC-7)", async () => {
      prismaMock.courier.create.mockRejectedValue(uniqueViolation());
      prismaMock.user.findUnique.mockResolvedValue({
        pointWorker: null,
        courier: { id: "c-1" },
      });

      await expect(service.grantCourier("user-1")).resolves.toEqual({
        staffRoles: ["COURIER"],
        point: null,
      });
    });
  });

  describe("movePoint", () => {
    it("rewrites the point of the caller's own row only (AC-8)", async () => {
      prismaMock.pointWorker.findUnique.mockResolvedValue({
        pickupPointId: "pp-1",
      });
      prismaMock.pickupPoint.findUnique.mockResolvedValue(otherPoint);
      const info = jest.spyOn(logger, "info");

      const answer = await service.movePoint("user-1", "pp-2");

      expect(prismaMock.pointWorker.update).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        data: { pickupPointId: "pp-2" },
      });
      expect(answer.point).toEqual(otherPoint);
      expect(info).toHaveBeenCalledWith({
        event: "staff.point-worker.moved",
        userId: "user-1",
        pickupPointId: "pp-2",
      });
    });

    it("answers the stored row and writes nothing for the same point (AC-8)", async () => {
      prismaMock.pointWorker.findUnique.mockResolvedValue({
        pickupPointId: "pp-1",
      });
      const info = jest.spyOn(logger, "info");

      const answer = await service.movePoint("user-1", "pp-1");

      expect(prismaMock.pointWorker.update).not.toHaveBeenCalled();
      expect(answer.point).toEqual(POINT);
      expect(info).not.toHaveBeenCalled();
    });

    it("refuses an unknown point (AC-8)", async () => {
      prismaMock.pointWorker.findUnique.mockResolvedValue({
        pickupPointId: "pp-1",
      });
      prismaMock.pickupPoint.findUnique.mockResolvedValue(null);

      await expect(service.movePoint("user-1", "pp-9")).rejects.toMatchObject({
        code: "UNKNOWN_PICKUP_POINT",
      });
      expect(prismaMock.pointWorker.update).not.toHaveBeenCalled();
    });

    it("refuses a closed point (AC-8)", async () => {
      prismaMock.pointWorker.findUnique.mockResolvedValue({
        pickupPointId: "pp-1",
      });
      prismaMock.pickupPoint.findUnique.mockResolvedValue({
        ...otherPoint,
        isActive: false,
      });

      await expect(service.movePoint("user-1", "pp-2")).rejects.toMatchObject({
        code: "PICKUP_POINT_INACTIVE",
      });
      expect(prismaMock.pointWorker.update).not.toHaveBeenCalled();
    });
  });

  describe("reads", () => {
    it("serves a point that was switched off (AC-9)", async () => {
      prismaMock.pointWorker.findUnique.mockResolvedValue({
        pickupPointId: "pp-1",
      });
      prismaMock.pickupPoint.findUnique.mockResolvedValue({
        ...POINT,
        isActive: false,
      });

      const answer = await service.readPoint("user-1");

      expect(answer.point).toEqual({ ...POINT, isActive: false });
    });

    it("refuses a read from an account without the role (AC-9)", async () => {
      prismaMock.pointWorker.findUnique.mockResolvedValue(null);

      await expect(service.readPoint("user-1")).rejects.toMatchObject({
        status: 403,
        code: "NOT_POINT_WORKER",
      });
    });

    it("answers the courier read without a point (AC-10)", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        pointWorker: null,
        courier: { id: "c-1" },
      });

      await expect(service.readCourier("user-1")).resolves.toEqual({
        staffRoles: ["COURIER"],
        point: null,
      });
    });
  });
});
