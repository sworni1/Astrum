import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CheckoutFormData } from "@/common/zodSchemes/checkout.scheme";
import { Form } from "@/components/ui/form";
import DeliveryDateField from "@/features/pages/Checkout/components/fields/DeliveryDateField";

const state = vi.hoisted(() => ({ calls: [] as Intl.DateTimeFormatOptions[] }));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) =>
    `${namespace}.${key}`,

  useFormatter: () => ({
    dateTime: (value: Date, options: Intl.DateTimeFormatOptions = {}) => {
      const timeZone = options.timeZone ?? "UTC";

      state.calls.push({ ...options, timeZone });

      return new Intl.DateTimeFormat("en-US", { ...options, timeZone }).format(
        value,
      );
    },
  }),
}));

const Host = ({ value }: { value: Date }) => {
  const form = useForm<CheckoutFormData>({
    defaultValues: { deliveryDate: value } as CheckoutFormData,
  });

  return (
    <Form {...form}>
      <DeliveryDateField control={form.control} />
    </Form>
  );
};

let container: HTMLDivElement;
let root: Root;

const render = async (value: Date): Promise<void> => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(<Host value={value} />);
  });
};

const trigger = (): HTMLButtonElement =>
  container.querySelector("button[type='button']") as HTMLButtonElement;

const browserZone = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone;

describe("DeliveryDateField", () => {
  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
    state.calls = [];
  });

  it("печатает выбранный день, а не сутки раньше в UTC (AC-12)", async () => {
    const picked = new Date(2026, 10, 25);

    await render(picked);

    const expected = new Intl.DateTimeFormat("en-US", {
      dateStyle: "long",
      timeZone: browserZone(),
    }).format(picked);

    expect(trigger().textContent).toContain(expected);
    expect(state.calls.at(-1)?.timeZone).toBe(browserZone());
  });
});
