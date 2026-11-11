import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PickupPoint } from "@/common/types/order.types";
import type { CheckoutFormData } from "@/common/zodSchemes/checkout.scheme";
import { Form } from "@/components/ui/form";
import PickupPointField from ".";

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}));

type FieldProps = {
  points: PickupPoint[];
  isLoading: boolean;
  hasFailed: boolean;
  onRetry: () => void;
};

const Host = ({ points, isLoading, hasFailed, onRetry }: FieldProps) => {
  const form = useForm<CheckoutFormData>({
    defaultValues: { pickupPointId: "" },
  });

  return (
    <Form {...form}>
      <PickupPointField
        control={form.control}
        points={points}
        isLoading={isLoading}
        hasFailed={hasFailed}
        onRetry={onRetry}
      />
    </Form>
  );
};

let container: HTMLDivElement;
let root: Root;

const render = async (props: FieldProps): Promise<void> => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(<Host {...props} />);
  });
};

const trigger = (): HTMLButtonElement =>
  container.querySelector("[data-slot='select-trigger']") as HTMLButtonElement;

describe("PickupPointField", () => {
  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("читает загрузку на триггере и закрывает выбор (AC-6)", async () => {
    await render({
      points: [],
      isLoading: true,
      hasFailed: false,
      onRetry: vi.fn(),
    });

    expect(trigger().textContent).toContain("cart.pickupLoading");
    expect(trigger().disabled).toBe(true);
  });

  it("зовёт точку к выбору и держит выбор открытым (AC-6)", async () => {
    await render({
      points: [{ id: "pp-1", name: "Central Pickup", address: "Tverskaya 12" }],
      isLoading: false,
      hasFailed: false,
      onRetry: vi.fn(),
    });

    expect(trigger().textContent).toContain("cart.pickupSelect");
    expect(trigger().disabled).toBe(false);
  });

  it("показывает отказ, закрывает выбор и повторяет запрос (AC-6)", async () => {
    const onRetry = vi.fn();

    await render({
      points: [],
      isLoading: false,
      hasFailed: true,
      onRetry,
    });

    expect(container.textContent).toContain("cart.pickupLoadFailed");
    expect(trigger().disabled).toBe(true);

    const retry = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "cart.pickupRetry",
    );

    await act(async () => {
      retry?.click();
    });

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
