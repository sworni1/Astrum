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

import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import express, { type Express } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../../../lib/prisma";
import { requireActiveAccount } from "../../../middlewares/requireActiveAccount";
import {
  requireCourier,
  requirePointWorker,
} from "../../../middlewares/staffRole";
import staffRoutes from "../staff.routes";

const prismaMock = prisma as unknown as {
  user: { findUnique: jest.Mock };
  pickupPoint: { findUnique: jest.Mock };
  pointWorker: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
  courier: { findUnique: jest.Mock; create: jest.Mock };
};

const APP_SOURCE = readFileSync(join(__dirname, "../../../app.ts"), "utf8");

type Handler = { handle: unknown };
type Route = {
  route?: { path: string; methods: Record<string, boolean>; stack: Handler[] };
};

const routesOf = (staffRoutes as unknown as { stack: Route[] }).stack.filter(
  (layer) => layer.route !== undefined,
);

const routeOf = (
  path: string,
  method: "get" | "post" | "patch" | "delete",
): Route => {
  const found = routesOf.find(
    (layer) => layer.route?.path === path && layer.route.methods[method],
  );

  if (!found) {
    throw new Error(`No ${method} route for ${path}`);
  }

  return found;
};

const handlersOf = (
  path: string,
  method: "get" | "post" | "patch" | "delete",
): unknown[] =>
  routeOf(path, method).route?.stack.map((layer) => layer.handle) ?? [];

const startServer = async (): Promise<{
  close: () => Promise<void>;
  url: string;
}> => {
  const app: Express = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as express.Request & { userId: string }).userId = "user-1";
    next();
  });
  app.use("/api", staffRoutes);

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

const call = async (
  url: string,
  path: string,
  method: "GET" | "POST" | "PATCH",
  body?: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> => {
  const response = await fetch(`${url}/api${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  return { status: response.status, body: await response.json() };
};

const POINT = {
  id: "pp-1",
  name: "Central Pickup",
  address: "Tverskaya 12",
  isActive: true,
};

describe("staff routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    prismaMock.user.findUnique.mockResolvedValue({
      status: "ACTIVE",
      pointWorker: { pickupPointId: "pp-1" },
      courier: null,
    });
    prismaMock.pickupPoint.findUnique.mockResolvedValue(POINT);
    prismaMock.pointWorker.findUnique.mockResolvedValue(null);
    prismaMock.pointWorker.create.mockResolvedValue({});
    prismaMock.pointWorker.update.mockResolvedValue({});
    prismaMock.courier.findUnique.mockResolvedValue(null);
    prismaMock.courier.create.mockResolvedValue({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("mounts the gates in order: account, role, validation (AC-8)", () => {
    const grant = handlersOf("/staff/point-worker", "post");
    const move = handlersOf("/staff/point-worker", "patch");
    const couponrier = handlersOf("/staff/courier", "post");

    expect(grant[0]).toBe(requireActiveAccount);
    expect(grant).toHaveLength(3);
    expect(move[0]).toBe(requireActiveAccount);
    expect(move[1]).toBe(requirePointWorker);
    expect(move).toHaveLength(4);
    expect(couponrier[0]).toBe(requireActiveAccount);
    expect(couponrier).toHaveLength(2);
  });

  it("mounts both reads behind their role guard and no account gate (AC-9, AC-10)", () => {
    expect(handlersOf("/staff/point", "get")).toEqual([
      requirePointWorker,
      expect.any(Function),
    ]);
    expect(handlersOf("/staff/courier", "get")).toEqual([
      requireCourier,
      expect.any(Function),
    ]);
  });

  it("mounts the counter queue behind the role guard and no account gate (spec 0018, AC-1)", () => {
    expect(handlersOf("/staff/point/orders", "get")).toEqual([
      requirePointWorker,
      expect.any(Function),
    ]);
  });

  it("mounts both counter writes behind the account gate, then the role guard (spec 0018, AC-4, AC-6)", () => {
    expect(
      handlersOf("/staff/point/orders/:orderId/handover", "patch"),
    ).toEqual([requireActiveAccount, requirePointWorker, expect.any(Function)]);
    expect(handlersOf("/staff/point/orders/:orderId/cancel", "patch")).toEqual([
      requireActiveAccount,
      requirePointWorker,
      expect.any(Function),
    ]);
  });

  it("mounts every courier write behind the account gate, then the role guard (spec 0019, AC-6)", () => {
    expect(
      handlersOf("/staff/courier/orders/:orderId/claim", "post"),
    ).toEqual([requireActiveAccount, requireCourier, expect.any(Function)]);
    expect(
      handlersOf("/staff/courier/orders/:orderId/claim", "delete"),
    ).toEqual([requireActiveAccount, requireCourier, expect.any(Function)]);
    expect(
      handlersOf("/staff/courier/orders/:orderId/handover", "patch"),
    ).toEqual([requireActiveAccount, requireCourier, expect.any(Function)]);
    expect(
      handlersOf("/staff/courier/orders/:orderId/cancel", "patch"),
    ).toEqual([requireActiveAccount, requireCourier, expect.any(Function)]);
  });

  it("refuses the counter queue for an account with no point role (spec 0018, AC-1)", async () => {
    const server = await startServer();

    try {
      const answer = await call(server.url, "/staff/point/orders", "GET");

      expect(answer.status).toBe(StatusCodes.FORBIDDEN);
      expect(answer.body).toMatchObject({ code: "NOT_POINT_WORKER" });
    } finally {
      await server.close();
    }
  });

  it("is mounted once inside the /api chain behind authenticateToken (AC-4)", () => {
    const references = APP_SOURCE.match(/staffRoutes/g) ?? [];
    const mountAt = APP_SOURCE.lastIndexOf("staffRoutes");
    const mountStart = APP_SOURCE.lastIndexOf("app.use(", mountAt);
    const mount = APP_SOURCE.slice(mountStart, mountAt);

    expect(references).toHaveLength(2);
    expect(mount).toContain('"/api"');
    expect(mount).toContain("authenticateToken");
    expect(APP_SOURCE).not.toMatch(/app\.use\(\s*"\/api\/staff/);
  });

  it("grants the point role and answers the roles with the point (AC-4)", async () => {
    const server = await startServer();

    try {
      const answer = await call(server.url, "/staff/point-worker", "POST", {
        pickupPointId: "pp-1",
      });

      expect(answer.status).toBe(StatusCodes.OK);
      expect(answer.body).toEqual({
        staffRoles: ["POINT_WORKER"],
        point: POINT,
      });
    } finally {
      await server.close();
    }
  });

  it("answers 422 VALIDATION with the field name the screen keys on (AC-4)", async () => {
    const server = await startServer();

    try {
      const answer = await call(server.url, "/staff/point-worker", "POST", {});

      expect(answer.status).toBe(StatusCodes.UNPROCESSABLE_ENTITY);
      expect(answer.body).toMatchObject({
        code: "VALIDATION",
        errors: [{ property: "pickupPointId" }],
      });
      expect(prismaMock.pointWorker.create).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it("answers 409 with the code the screen branches on for an unknown point (AC-5)", async () => {
    prismaMock.pickupPoint.findUnique.mockResolvedValue(null);
    const server = await startServer();

    try {
      const answer = await call(server.url, "/staff/point-worker", "POST", {
        pickupPointId: "pp-9",
      });

      expect(answer.status).toBe(StatusCodes.CONFLICT);
      expect(answer.body).toMatchObject({ code: "UNKNOWN_PICKUP_POINT" });
    } finally {
      await server.close();
    }
  });

  it("grants the courier role with a null point (AC-7)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      status: "ACTIVE",
      pointWorker: null,
      courier: { id: "c-1" },
    });
    const server = await startServer();

    try {
      const answer = await call(server.url, "/staff/courier", "POST");

      expect(answer.status).toBe(StatusCodes.OK);
      expect(answer.body).toEqual({ staffRoles: ["COURIER"], point: null });
    } finally {
      await server.close();
    }
  });

  it("refuses a PENDING account before the body is validated (AC-8)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ status: "PENDING" });
    const server = await startServer();

    try {
      const answer = await call(server.url, "/staff/point-worker", "PATCH", {});

      expect(answer.status).toBe(StatusCodes.FORBIDDEN);
      expect(answer.body).toMatchObject({ code: "EMAIL_NOT_CONFIRMED" });
      expect(prismaMock.pointWorker.update).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it("refuses an ACTIVE account without the role before the body is validated (AC-8)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ status: "ACTIVE" });
    prismaMock.pointWorker.findUnique.mockResolvedValue(null);
    const server = await startServer();

    try {
      const answer = await call(server.url, "/staff/point-worker", "PATCH", {});

      expect(answer.status).toBe(StatusCodes.FORBIDDEN);
      expect(answer.body).toMatchObject({ code: "NOT_POINT_WORKER" });
    } finally {
      await server.close();
    }
  });

  it("answers 422 for an invalid body from an active point worker (AC-8)", async () => {
    prismaMock.pointWorker.findUnique.mockResolvedValue({
      pickupPointId: "pp-1",
    });
    const server = await startServer();

    try {
      const answer = await call(server.url, "/staff/point-worker", "PATCH", {});

      expect(answer.status).toBe(StatusCodes.UNPROCESSABLE_ENTITY);
      expect(answer.body).toMatchObject({ code: "VALIDATION" });
    } finally {
      await server.close();
    }
  });

  it("moves the point of the caller (AC-8)", async () => {
    prismaMock.pointWorker.findUnique.mockResolvedValue({
      pickupPointId: "pp-1",
    });
    const server = await startServer();

    try {
      const answer = await call(server.url, "/staff/point-worker", "PATCH", {
        pickupPointId: "pp-1",
      });

      expect(answer.status).toBe(StatusCodes.OK);
      expect(answer.body).toEqual({
        staffRoles: ["POINT_WORKER"],
        point: POINT,
      });
      expect(prismaMock.pointWorker.update).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it("answers the point read without a point gate on the account status (AC-9)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      status: "PENDING",
      pointWorker: { pickupPointId: "pp-1" },
      courier: null,
    });
    prismaMock.pointWorker.findUnique.mockResolvedValue({
      pickupPointId: "pp-1",
    });
    const server = await startServer();

    try {
      const answer = await call(server.url, "/staff/point", "GET");

      expect(answer.status).toBe(StatusCodes.OK);
      expect(answer.body).toEqual({
        staffRoles: ["POINT_WORKER"],
        point: POINT,
      });
    } finally {
      await server.close();
    }
  });

  it("refuses the point read without the role (AC-9)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ status: "ACTIVE" });
    prismaMock.pointWorker.findUnique.mockResolvedValue(null);
    const server = await startServer();

    try {
      const answer = await call(server.url, "/staff/point", "GET");

      expect(answer.status).toBe(StatusCodes.FORBIDDEN);
      expect(answer.body).toMatchObject({ code: "NOT_POINT_WORKER" });
    } finally {
      await server.close();
    }
  });

  it("refuses the courier read without the role (AC-10)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ status: "ACTIVE" });
    prismaMock.courier.findUnique.mockResolvedValue(null);
    const server = await startServer();

    try {
      const answer = await call(server.url, "/staff/courier", "GET");

      expect(answer.status).toBe(StatusCodes.FORBIDDEN);
      expect(answer.body).toMatchObject({ code: "NOT_COURIER" });
    } finally {
      await server.close();
    }
  });

  it("answers 503 instead of a refusal when the role read fails (AC-10)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ status: "ACTIVE" });
    prismaMock.courier.findUnique.mockRejectedValue(
      new Error("connection lost"),
    );
    const server = await startServer();

    try {
      const answer = await call(server.url, "/staff/courier", "GET");

      expect(answer.status).toBe(StatusCodes.SERVICE_UNAVAILABLE);
      expect(answer.body).toMatchObject({ code: "STAFF_ROLE_UNAVAILABLE" });
    } finally {
      await server.close();
    }
  });
});
