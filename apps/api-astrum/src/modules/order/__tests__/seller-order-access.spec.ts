jest.mock("../../../../lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    business: { findUnique: jest.fn() },
    order: { findMany: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
    orderItem: {
      count: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

import type { AddressInfo } from "node:net";
import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import { sign } from "jsonwebtoken";
import { Prisma } from "@astrum/db/client";
import { prisma } from "../../../../lib/prisma";
import { logger } from "../../../common/helpers/logger";
import { createAuthenticateToken } from "../../../middlewares/authenticateToken";
import type { SessionStore } from "../../../session/sessionStore";
import sellerOrderRoutes, { refuseSellerWrite } from "../seller-order.routes";

const prismaMock = prisma as unknown as {
  $transaction: jest.Mock;
  $queryRaw: jest.Mock;
  business: { findUnique: jest.Mock };
  order: { findMany: jest.Mock; updateMany: jest.Mock; update: jest.Mock };
  orderItem: {
    count: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
};

const JWT_SECRET = "seller-panel-read-only-secret";
const SID = "sid-1";
const USER_ID = "user-1";

const sessionStore = {
  get: jest.fn(),
} as unknown as SessionStore;

const authCookie = (): string => {
  const token = sign({ userId: USER_ID, sid: SID }, JWT_SECRET);

  return `__auth=${token}`;
};

type Harness = { close: () => Promise<void>; url: string };

const startServer = async (): Promise<Harness> => {
  const app: Express = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api", createAuthenticateToken(sessionStore), sellerOrderRoutes);

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
};

const sellerLineRow = {
  id: "line-1",
  orderId: "order-12345678",
  productId: "product-1",
  name: "Drill",
  previewImage: "https://cdn.test/drill.png",
  quantity: 2,
  price: new Prisma.Decimal("19.99"),
  currency: "RUB",
  status: "CONFIRMED" as const,
  order: {
    createdAt: new Date("2026-11-14T09:00:00.000Z"),
    pickupPointName: "Central",
    pickupPointAddress: "Tverskaya 12",
    handedOverAt: null,
    deliveryAddress: null,
    shippingMethod: { isPickup: true },
  },
};

const sellerAggregateRow = {
  status: "CONFIRMED",
  currency: "RUB",
  count: 1,
  units: "2",
  revenue: "39.98",
};

const routeWithPath = (path: string) =>
  (
    sellerOrderRoutes as unknown as {
      stack: Array<{ route?: { path: string; stack: Array<{ handle: unknown }> } }>;
    }
  ).stack.find((layer) => layer.route?.path === path);

describe("Seller panel refusals", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;
  });

  beforeEach(() => {
    prismaMock.business.findUnique.mockResolvedValue({ id: "business-1" });
    prismaMock.$transaction.mockImplementation(
      (operations: Array<Promise<unknown>>) => Promise.all(operations),
    );
    prismaMock.orderItem.count.mockResolvedValue(1);
    prismaMock.orderItem.findMany.mockResolvedValue([sellerLineRow]);
    prismaMock.$queryRaw.mockResolvedValue([sellerAggregateRow]);
    (sessionStore.get as jest.Mock).mockResolvedValue(
      JSON.stringify({ userId: USER_ID }),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it("mounts one shared handler on both write paths (AC-9)", () => {
    const handover = routeWithPath("/seller/orders/:orderId/handover");
    const status = routeWithPath("/order-items/:orderItemId/status");

    expect(handover?.route?.stack.map((layer) => layer.handle)).toEqual([
      refuseSellerWrite,
    ]);
    expect(status?.route?.stack.map((layer) => layer.handle)).toEqual([
      refuseSellerWrite,
    ]);
  });

  it("answers 404 SELLER_PANEL_READ_ONLY to a seller handover and writes nothing (AC-9)", async () => {
    const warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined);
    const server = await startServer();

    try {
      const response = await fetch(
        `${server.url}/api/seller/orders/order-1/handover?from=stale-tab`,
        {
          method: "PATCH",
          headers: { Cookie: authCookie() },
        },
      );

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        code: "SELLER_PANEL_READ_ONLY",
        message: "Seller writes were removed; the panel is read only.",
      });
      expect(prismaMock.order.update).not.toHaveBeenCalled();
      expect(prismaMock.order.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.orderItem.update).not.toHaveBeenCalled();
      expect(prismaMock.orderItem.updateMany).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith({
        event: "seller.write_refused",
        userId: USER_ID,
        method: "PATCH",
        path: "/api/seller/orders/order-1/handover?from=stale-tab",
        orderId: "order-1",
      });
    } finally {
      await server.close();
    }
  });

  it("answers 404 to a seller line status change and leaves the rows untouched (AC-9)", async () => {
    const warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined);
    const rowBefore = JSON.stringify(sellerLineRow);
    const server = await startServer();

    try {
      const response = await fetch(
        `${server.url}/api/order-items/line-1/status`,
        {
          method: "PATCH",
          headers: {
            Cookie: authCookie(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "CANCELLED" }),
        },
      );

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({
        code: "SELLER_PANEL_READ_ONLY",
      });
      expect(JSON.stringify(sellerLineRow)).toBe(rowBefore);
      expect(prismaMock.orderItem.update).not.toHaveBeenCalled();
      expect(prismaMock.orderItem.updateMany).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith({
        event: "seller.write_refused",
        userId: USER_ID,
        method: "PATCH",
        path: "/api/order-items/line-1/status",
        orderItemId: "line-1",
      });
    } finally {
      await server.close();
    }
  });

  it("never logs the body, a cookie or a token on a refusal (AC-9)", async () => {
    const warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined);
    const server = await startServer();

    try {
      await fetch(`${server.url}/api/seller/orders/order-1/handover`, {
        method: "PATCH",
        headers: { Cookie: authCookie() },
      });

      const fields = warn.mock.calls[0][0];

      expect(Object.keys(fields).sort()).toEqual([
        "event",
        "method",
        "orderId",
        "path",
        "userId",
      ]);
    } finally {
      await server.close();
    }
  });

  it("answers 401 with no cookie before the handler runs (AC-9)", async () => {
    const warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined);
    const server = await startServer();

    try {
      const response = await fetch(
        `${server.url}/api/order-items/line-1/status`,
        { method: "PATCH" },
      );

      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({
        code: "SESSION_MISSING",
      });
      expect(warn).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it("serves the read with exactly the documented keys and no buyer identity (AC-3)", async () => {
    const server = await startServer();

    try {
      const response = await fetch(`${server.url}/api/seller/orders`, {
        headers: { Cookie: authCookie() },
      });
      const body = (await response.json()) as {
        items: Array<Record<string, unknown>>;
        counts: Record<string, number>;
        stats: { revenue: Array<{ currency: string; amount: number }>; units: number };
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };

      expect(response.status).toBe(200);
      expect(body.total).toBe(1);
      expect(body.counts).toEqual({ all: 1, delivered: 0, canceled: 0 });
      expect(body.stats).toEqual({ revenue: [], units: 0 });
      expect(Object.keys(body.items[0]).sort()).toEqual([
        "createdAt",
        "currency",
        "deliveryAddress",
        "handedOverAt",
        "id",
        "isPickup",
        "name",
        "orderId",
        "pickupPointAddress",
        "pickupPointName",
        "previewImage",
        "price",
        "productId",
        "quantity",
        "status",
        "subtotal",
      ]);
      expect(body.items[0].price).toBe(19.99);
      expect(body.items[0].subtotal).toBe(39.98);
    } finally {
      await server.close();
    }
  });

  it("refuses a bogus status filter with its own code (AC-2)", async () => {
    const server = await startServer();

    try {
      const response = await fetch(
        `${server.url}/api/seller/orders?status=delivered`,
        { headers: { Cookie: authCookie() } },
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        code: "INVALID_STATUS_FILTER",
      });
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it("keeps the read open to a PENDING account (AC-7)", async () => {
    prismaMock.business.findUnique.mockResolvedValue({ id: "business-1" });
    const server = await startServer();

    try {
      const response = await fetch(`${server.url}/api/seller/orders`, {
        headers: { Cookie: authCookie() },
      });

      expect(response.status).toBe(200);
      expect(prismaMock.business.findUnique).toHaveBeenCalledWith({
        where: { ownerUserId: USER_ID },
        select: { id: true },
      });
    } finally {
      await server.close();
    }
  });
});
