import { z } from "zod";
import { PaymentMethod } from "../types/order.types";

export const checkoutFormSchema = z.object({
  deliveryAddress: z
    .string()
    .min(10, "Delivery address must be at least 10 characters"),
  deliveryDate: z.date({ error: "Please select a delivery date" }),
  shippingMethodId: z.string().min(1, "Please select a shipping method"),
  paymentMethod: z.enum(PaymentMethod, {
    error: "Please select a payment method",
  }),
  paymentDetails: z.string().optional(),
});

export type CheckoutFormData = z.infer<typeof checkoutFormSchema>;
