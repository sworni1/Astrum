import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import express from "express";
import { StatusCodes } from "http-status-codes";

jest.mock("../../../../lib/prisma", () => ({
  prisma: {
    shippingMethod: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: "sm-1",
          name: "Standard Delivery",
          price: 299,
          currency: "RUB",
        },
      ]),
    },
  },
}));

import shippingRoutes from "../shipping.routes";

/**
 * `app.ts` cannot be imported here: it needs `AUTH_SERVICE_URL`, a Redis
 * session store and a live Prisma client at module load. So the router is
 * mounted in a bare app with a counting stub where the real session middleware
 * sits, which is the seam `app.ts` wires (AC-14).
 */
const SESSION_COOKIE = "__auth=session";
const APP_SOURCE = readFileSync(join(__dirname, "../../../app.ts"), "utf8");

const counted = { value: 0 };
let server: Server;

const startApp = async (): Promise<string> => {
  const app = express();

  app.use(
    "/api",
    (req, res, next) => {
      counted.value += 1;

      if (req.headers.cookie !== SESSION_COOKIE) {
        res.status(StatusCodes.UNAUTHORIZED).json({ code: "NO_SESSION" });
        return;
      }

      next();
    },
    shippingRoutes,
  );

  server = app.listen(0);
  await new Promise((resolve) => {
    server.once("listening", resolve);
  });

  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
};

describe("shipping router", () => {
  let url = "";

  beforeAll(async () => {
    url = await startApp();
  });

  afterAll(async () => {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  });

  beforeEach(() => {
    counted.value = 0;
  });

  it("отказывает 401 без сессии и просит сессию ровно один раз (AC-4)", async () => {
    const response = await fetch(`${url}/api/shipping-methods`);
    const body = (await response.json()) as { code?: string };

    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
    expect(body.code).toBe("NO_SESSION");
    expect(counted.value).toBe(1);
  });

  it("отдаёт методы активной сессии и тоже читает её один раз (AC-4)", async () => {
    const response = await fetch(`${url}/api/shipping-methods`, {
      headers: { cookie: SESSION_COOKIE },
    });
    const body = (await response.json()) as { methods?: unknown[] };

    expect(response.status).toBe(StatusCodes.OK);
    expect(body.methods).toHaveLength(1);
    expect(counted.value).toBe(1);
  });

  it("смонтирован ровно одной строкой app.use в цепочке /api (AC-4)", () => {
    const references = APP_SOURCE.match(/shippingRoutes/g) ?? [];
    const mountAt = APP_SOURCE.lastIndexOf("shippingRoutes");
    const mountStart = APP_SOURCE.lastIndexOf("app.use(", mountAt);
    const mount = APP_SOURCE.slice(mountStart, mountAt);

    expect(references).toHaveLength(2);
    expect(mount).toContain('"/api"');
    expect(mount).toContain("authenticateToken");
    expect(APP_SOURCE).not.toMatch(/app\.use\(\s*"\/api\/shipping/);
  });
});
