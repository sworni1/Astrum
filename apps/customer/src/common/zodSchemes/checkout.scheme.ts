import { z } from "zod";
import { PaymentMethod } from "@/common/types/order.types";
import type { ValidationTranslator } from "./translator";

export const createCheckoutFormSchema = (t: ValidationTranslator) =>
  z.object({
    deliveryAddress: z.string().min(10, t("deliveryAddressTooShort")),
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
