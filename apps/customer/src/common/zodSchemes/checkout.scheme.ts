import { z } from "zod";
import { PaymentMethod } from "../types/order.types";

export const checkoutFormSchema = z.object({
  deliveryAddress: z
    .string()
    .min(10, "Delivery address must be at least 10 characters")
    .nonempty("Delivery address is required"),
  deliveryDate: z.date({
    required_error: "Please select a delivery date",
  }),
  shippingMethodId: z.string().nonempty("Please select a shipping method"),
  paymentMethod: z.nativeEnum(PaymentMethod, {
    required_error: "Please select a payment method",
  }),
  paymentDetails: z.string().optional(),
});

export type CheckoutFormData = z.infer<typeof checkoutFormSchema>;
