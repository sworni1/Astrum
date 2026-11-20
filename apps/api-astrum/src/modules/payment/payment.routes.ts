import express, { Router } from "express";
import { handleStripeWebhook } from "./payment.webhook.controller";

export const STRIPE_WEBHOOK_PATH = "/api/payments/stripe/webhook";

const paymentWebhookRoutes: Router = Router();

paymentWebhookRoutes.post(
  "/",
  express.raw({ type: "application/json", limit: "1mb" }),
  handleStripeWebhook,
);

export default paymentWebhookRoutes;
