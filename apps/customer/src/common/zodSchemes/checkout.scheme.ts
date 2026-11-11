import { z } from "zod";
import { PaymentMethod } from "@/common/types/order.types";
import type { ValidationTranslator } from "./translator";

/**
 * One delivery block with one of two required fields: the address for a courier
 * method, the point for a pickup method. `isPickup` decides which requirement is
 * live, so the other field never blocks a submit.
 */
export const createCheckoutFormSchema = (
  t: ValidationTranslator,
  isPickup: boolean,
) =>
  z.object({
    deliveryAddress: isPickup
      ? z.string()
      : z.string().min(10, t("deliveryAddressTooShort")),
    pickupPointId: isPickup
      ? z.string().min(1, t("pickupPointRequired"))
      : z.string(),
    deliveryDate: z.date({ error: t("deliveryDateRequired") }),
    shippingMethodId: z.string().min(1, t("shippingMethodRequired")),
    paymentMethod: z.enum(PaymentMethod, {
      error: t("paymentMethodRequired"),
    }),
    paymentDetails: z.string().optional(),
  });

export type CheckoutFormData = z.infer<
  ReturnType<typeof createCheckoutFormSchema>
>;
