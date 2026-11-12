import express, { Router } from "express";
import { handleStripeWebhook } from "./payment.webhook.controller";

/** The 1 MB cap is the application level brake on the one public route (AC-5). */
export const STRIPE_WEBHOOK_PATH = "/api/payments/stripe/webhook";

/**
 * Mounted in `app.ts` before `express.json`, because the signature is computed
 * over the raw bytes and a parsed body cannot be verified (AC-5).
 */
const paymentWebhookRoutes: Router = Router();

paymentWebhookRoutes.post(
  "/",
  express.raw({ type: "application/json", limit: "1mb" }),
  handleStripeWebhook,
);

export default paymentWebhookRoutes;
