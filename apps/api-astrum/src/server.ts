import "reflect-metadata";
import type { Server } from "node:http";
import { prisma } from "../lib/prisma";
import app from "./app";
import { startOrderShipping } from "./modules/order/order-shipping";
import { startPaymentSweep } from "./modules/payment/payment.sweep";

if (!process.env.RABBITMQ_URL) {
  throw new Error(
    "RABBITMQ_URL is required: the gateway publishes the event an email change produces",
  );
}

const PORT = Number(process.env.API_PORT ?? 3580);
const SHUTDOWN_TIMEOUT_MS = 10_000;

const server: Server = app.listen(PORT, () => {
  console.log(`API Gateway running at http://localhost:${PORT}/api`);
});

// The reconciliation pass belongs to the running process, never to app.ts: a
// test that imports the app must not start a timer (spec 0015, AC-9).
const sweep = startPaymentSweep();

// An accepted order is marked sent after ORDER_SHIPPING_DELAY_MS, on its own
// timer, so the payment sweep stays about money (spec 0016, amendments).
const shipping = startOrderShipping();

const shutdown = (signal: NodeJS.Signals): void => {
  console.log(`[api] ${signal} received, draining connections`);

  clearInterval(sweep);
  clearInterval(shipping);

  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });

  setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
