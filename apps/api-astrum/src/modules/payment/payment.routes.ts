import express, { Router } from "express";
import { STRIPE_WEBHOOK_BODY_OPTIONS } from "./constants/payment.constants";
import { handleStripeWebhook } from "./payment.webhook.controller";

export const STRIPE_WEBHOOK_PATH = "/api/payments/stripe/webhook";

const paymentWebhookRoutes: Router = Router();

paymentWebhookRoutes.post(
  "/",
  express.raw(STRIPE_WEBHOOK_BODY_OPTIONS),
  handleStripeWebhook,
);

export default paymentWebhookRoutes;
