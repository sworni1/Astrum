import en from "@messages/en.json";
import ru from "@messages/ru.json";
import { describe, expect, it } from "vitest";
import { PaymentMethod } from "@/common/types/order.types";
import { createCheckoutFormSchema } from "./checkout.scheme";
import type { ValidationTranslator } from "./translator";

const translatorFor = (catalog: typeof en.validation) => {
  const translate = (
    key: keyof typeof catalog,
    values?: Record<string, unknown>,
  ) =>
    Object.entries(values ?? {}).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      catalog[key],
    );

  return translate as unknown as ValidationTranslator;
};

const courierSchema = createCheckoutFormSchema(
  translatorFor(en.validation),
  false,
);
const pickupSchema = createCheckoutFormSchema(
  translatorFor(en.validation),
  true,
);

const baseForm = {
  deliveryAddress: "Tverskaya 12, Moscow, 125009",
  pickupPointId: "pp-1",
  deliveryDate: new Date("2026-12-01T12:00:00.000Z"),
  shippingMethodId: "sm-1",
  paymentMethod: PaymentMethod.ONLINE_CARD,
  paymentDetails: "",
};

const issuesOf = (
  schema: typeof courierSchema,
  form: Record<string, unknown>,
): Array<{ path: string; message: string }> =>
  schema.safeParse(form).error?.issues.map((issue) => ({
    path: String(issue.path[0]),
    message: issue.message,
  })) ?? [];

describe("checkout form schema, courier mode", () => {
  it("требует адрес и не спрашивает точку (AC-5)", () => {
    const issues = issuesOf(courierSchema, {
      ...baseForm,
      deliveryAddress: "",
    });

    expect(issues).toEqual([
      {
        path: "deliveryAddress",
        message: en.validation.deliveryAddressTooShort,
      },
    ]);
  });

  it("пропускает форму без точки (AC-5)", () => {
    const result = courierSchema.safeParse({
      ...baseForm,
      pickupPointId: "",
    });

    expect(result.success).toBe(true);
  });

  it("пропускает форму, где выбраны и адрес, и точка (AC-5)", () => {
    expect(courierSchema.safeParse(baseForm).success).toBe(true);
  });
});

describe("checkout form schema, pickup mode", () => {
  it("требует точку и не спрашивает адрес (AC-5)", () => {
    const issues = issuesOf(pickupSchema, { ...baseForm, pickupPointId: "" });

    expect(issues).toEqual([
      { path: "pickupPointId", message: en.validation.pickupPointRequired },
    ]);
  });

  it("пропускает пустой адрес, когда выбрана точка (AC-5)", () => {
    expect(
      pickupSchema.safeParse({ ...baseForm, deliveryAddress: "" }).success,
    ).toBe(true);
  });

  it("берёт сообщение из русского каталога (AC-5)", () => {
    const issues = issuesOf(
      createCheckoutFormSchema(translatorFor(ru.validation), true),
      { ...baseForm, pickupPointId: "" },
    );

    expect(issues).toEqual([
      { path: "pickupPointId", message: ru.validation.pickupPointRequired },
    ]);
  });
});
