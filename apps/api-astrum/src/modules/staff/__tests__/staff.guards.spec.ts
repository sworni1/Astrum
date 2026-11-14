jest.mock("../../../../lib/prisma", () => ({
  prisma: {
    pointWorker: { findUnique: jest.fn() },
    courier: { findUnique: jest.fn() },
  },
}));

import type { AddressInfo } from "node:net";
import express, { type Express } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../../../lib/prisma";
import type { StaffRequest } from "../../../common/types/staff.types";
import {
  requireCourier,
  requirePointWorker,
} from "../../../middlewares/staffRole";

const pointWorkerFind = prisma.pointWorker.findUnique as unknown as jest.Mock;
const courierFind = prisma.courier.findUnique as unknown as jest.Mock;

const startServer = async (): Promise<{
  close: () => Promise<void>;
  url: string;
}> => {
  const app: Express = express();

  app.use((req, _res, next) => {
    (req as ExpressRequest).userId = "user-1";
    next();
  });

  app.get("/point", requirePointWorker, (req, res) => {
    res.status(StatusCodes.OK).json({ staff: (req as StaffRequest).staff });
  });

  app.get("/courier", requireCourier, (req, res) => {
    res.status(StatusCodes.OK).json({ staff: (req as StaffRequest).staff });
  });

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));

  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
};

type ExpressRequest = express.Request & { userId: string };

describe("staff role guards", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("refuses an account without the point role with 403 NOT_POINT_WORKER (AC-10)", async () => {
    pointWorkerFind.mockResolvedValue(null);
    const server = await startServer();

    try {
      const answer = await fetch(`${server.url}/point`);

      expect(answer.status).toBe(StatusCodes.FORBIDDEN);
      expect(await answer.json()).toMatchObject({ code: "NOT_POINT_WORKER" });
      expect(pointWorkerFind).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        select: { pickupPointId: true },
      });
    } finally {
      await server.close();
    }
  });

  it("refuses an account without the courier role with 403 NOT_COURIER (AC-10)", async () => {
    courierFind.mockResolvedValue(null);
    const server = await startServer();

    try {
      const answer = await fetch(`${server.url}/courier`);

      expect(answer.status).toBe(StatusCodes.FORBIDDEN);
      expect(await answer.json()).toMatchObject({ code: "NOT_COURIER" });
    } finally {
      await server.close();
    }
  });

  it("answers 503 STAFF_ROLE_UNAVAILABLE when the role read fails (AC-10)", async () => {
    pointWorkerFind.mockRejectedValue(new Error("connection lost"));
    const server = await startServer();

    try {
      const answer = await fetch(`${server.url}/point`);

      expect(answer.status).toBe(StatusCodes.SERVICE_UNAVAILABLE);
      expect(await answer.json()).toMatchObject({
        code: "STAFF_ROLE_UNAVAILABLE",
      });
    } finally {
      await server.close();
    }
  });

  it("passes a point worker through with the point id on the request (AC-10)", async () => {
    pointWorkerFind.mockResolvedValue({ pickupPointId: "pp-1" });
    const server = await startServer();

    try {
      const answer = await fetch(`${server.url}/point`);

      expect(answer.status).toBe(StatusCodes.OK);
      expect(await answer.json()).toEqual({
        staff: { role: "POINT_WORKER", pickupPointId: "pp-1" },
      });
    } finally {
      await server.close();
    }
  });

  it("passes a courier through with no point on the request (AC-10)", async () => {
    courierFind.mockResolvedValue({ userId: "user-1" });
    const server = await startServer();

    try {
      const answer = await fetch(`${server.url}/courier`);

      expect(await answer.json()).toEqual({
        staff: { role: "COURIER", pickupPointId: null },
      });
    } finally {
      await server.close();
    }
  });
});
