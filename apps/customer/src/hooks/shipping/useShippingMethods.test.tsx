import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getData } = vi.hoisted(() => ({ getData: vi.fn() }));

vi.mock("@/hooks/useFetcher", () => ({ useFetcher: () => ({ getData }) }));

import { useShippingMethods } from "./useShippingMethods";

const Probe = () => {
  const { methods, isLoading, error } = useShippingMethods();

  return (
    <span
      data-state={JSON.stringify({
        names: methods.map((method) => method.name),
        isLoading,
        failed: error !== null,
      })}
    />
  );
};

let container: HTMLDivElement;
let root: Root;

const state = () =>
  JSON.parse(
    container.querySelector("[data-state]")?.getAttribute("data-state") ?? "{}",
  ) as { names?: string[]; isLoading?: boolean; failed?: boolean };

const flush = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

const render = async (): Promise<void> => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(
      <SWRConfig
        value={{
          provider: () => new Map(),
          dedupingInterval: 0,
          shouldRetryOnError: false,
        }}
      >
        <Probe />
      </SWRConfig>,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await flush();
};

describe("useShippingMethods", () => {
  beforeEach(() => {
    getData.mockReset();
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("читает методы по своему пути и отдаёт список (AC-8)", async () => {
    getData.mockResolvedValue({
      methods: [
        { id: "sm-1", name: "Standard Delivery", price: 299, currency: "RUB" },
      ],
    });

    await render();

    expect(getData).toHaveBeenCalledWith("/shipping-methods");
    expect(state()).toMatchObject({
      names: ["Standard Delivery"],
      isLoading: false,
      failed: false,
    });
  });

  it("отдаёт пустой список без ошибки, когда методов нет (AC-10)", async () => {
    getData.mockResolvedValue({ methods: [] });

    await render();

    expect(state()).toMatchObject({ names: [], failed: false });
  });

  it("поднимает ошибку запроса, чтобы форма показала отказ (AC-10)", async () => {
    getData.mockRejectedValue(new Error("gateway is down"));

    await render();

    expect(state()).toMatchObject({ names: [], failed: true });
  });
});
