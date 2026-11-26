import "reflect-metadata";
import type { Server } from "node:http";
import { prisma } from "../lib/prisma";
import app from "./app";
import { closeCacheStore } from "./cache/cacheStore";
import {
  API_PORT_DEFAULT,
  SHUTDOWN_SIGNALS,
  SHUTDOWN_TIMEOUT_MS,
} from "./common/constants/server.constants";
import { startGuestSweep } from "./modules/guest/guest.sweep";
import { startOrderShipping } from "./modules/order/order-shipping";
import { startPaymentSweep } from "./modules/payment/payment.sweep";

if (!process.env.RABBITMQ_URL) {
  throw new Error(
    "RABBITMQ_URL is required: the gateway publishes the event an email change produces",
  );
}

const PORT = Number(process.env.API_PORT ?? API_PORT_DEFAULT);

const server: Server = app.listen(PORT, () => {
  console.log(`API Gateway running at http://localhost:${PORT}/api`);
});

const sweep = startPaymentSweep();

const shipping = startOrderShipping();

const guestSweep = startGuestSweep();

const shutdown = (signal: NodeJS.Signals): void => {
  console.log(`[api] ${signal} received, draining connections`);

  clearInterval(sweep);

  clearInterval(shipping);

  clearInterval(guestSweep);

  server.close(() => {
    void closeCacheStore()
      .then(() => prisma.$disconnect())
      .finally(() => process.exit(0));
  });

  setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
};

for (const signal of SHUTDOWN_SIGNALS) {
  process.on(signal, shutdown);
}
